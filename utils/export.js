const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
})();

function utf8Bytes(value) {
    const text = String(value);
    const bytes = [];
    for (let index = 0; index < text.length; index += 1) {
        let code = text.charCodeAt(index);
        if (code >= 0xD800 && code <= 0xDBFF) {
            const next = text.charCodeAt(index + 1);
            if (next >= 0xDC00 && next <= 0xDFFF) {
                code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00);
                index += 1;
            }
        }
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        } else {
            bytes.push(
                0xF0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3F),
                0x80 | ((code >> 6) & 0x3F),
                0x80 | (code & 0x3F)
            );
        }
    }
    return new Uint8Array(bytes);
}

function crc32(bytes) {
    let value = 0xFFFFFFFF;
    for (let index = 0; index < bytes.length; index += 1) {
        value = (value >>> 8) ^ CRC_TABLE[(value ^ bytes[index]) & 0xFF];
    }
    return (value ^ 0xFFFFFFFF) >>> 0;
}

function concatBytes(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
        result.set(part, offset);
        offset += part.length;
    });
    return result;
}

function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1F),
        date: (((year - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0x0F) << 5) | (date.getDate() & 0x1F),
    };
}

function createZip(files, date) {
    const stamped = dosDateTime(date);
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
        const nameBytes = utf8Bytes(file.name);
        const dataBytes = typeof file.data === 'string' ? utf8Bytes(file.data) : file.data;
        const checksum = crc32(dataBytes);

        const local = new Uint8Array(30 + nameBytes.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034B50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, stamped.time, true);
        localView.setUint16(12, stamped.date, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, dataBytes.length, true);
        localView.setUint32(22, dataBytes.length, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);
        local.set(nameBytes, 30);
        localParts.push(local, dataBytes);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02014B50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, stamped.time, true);
        centralView.setUint16(14, stamped.date, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, dataBytes.length, true);
        centralView.setUint32(24, dataBytes.length, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centralParts.push(central);

        offset += local.length + dataBytes.length;
    });

    const centralDirectory = concatBytes(centralParts);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return concatBytes([...localParts, centralDirectory, end]);
}

function escapeXml(value) {
    return String(value || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function textParagraph(text, options) {
    const settings = options || {};
    const properties = [];
    if (settings.keepNext) properties.push('<w:keepNext/>');
    if (settings.shading) properties.push(`<w:shd w:val="clear" w:color="auto" w:fill="${settings.shading}"/>`);
    if (settings.before || settings.after) {
        properties.push(`<w:spacing w:before="${settings.before || 0}" w:after="${settings.after || 0}"/>`);
    }
    if (settings.indent) properties.push(`<w:ind w:left="${settings.indent}"/>`);
    if (settings.align) properties.push(`<w:jc w:val="${settings.align}"/>`);
    const runProperties = [];
    if (settings.bold) runProperties.push('<w:b/>');
    if (settings.color) runProperties.push(`<w:color w:val="${settings.color}"/>`);
    if (settings.size) runProperties.push(`<w:sz w:val="${settings.size}"/><w:szCs w:val="${settings.size}"/>`);
    const pPr = properties.length ? `<w:pPr>${properties.join('')}</w:pPr>` : '';
    const rPr = runProperties.length ? `<w:rPr>${runProperties.join('')}</w:rPr>` : '';
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function formatAnswer(question) {
    return question.answer.map((key) => {
        if (question.type !== 'judge') return key;
        const option = question.options.find((item) => item.key === key);
        return option ? `${key}（${option.text}）` : key;
    }).join('、');
}

function pad(value) {
    return value < 10 ? `0${value}` : `${value}`;
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildFileName(prefix, date) {
    const safePrefix = String(prefix || '思政练习生').replace(/[\\/:*?"<>|]/g, '_');
    return `${safePrefix}_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.docx`;
}

function buildDocumentXml(questions, meta) {
    const body = [];
    body.push(textParagraph(meta.title || '思政练习生导出', {
        align: 'center', bold: true, color: '111111', size: 34, after: 100,
    }));
    body.push(textParagraph(`导出时间：${formatDate(meta.date)}　共 ${questions.length} 道题`, {
        align: 'center', color: '666666', size: 19, after: 80,
    }));
    body.push(textParagraph('题目编号、正确答案与题库保持一致；每道题附带解题思路、选项分析和记忆小注。', {
        color: '666666', size: 19, after: 220, shading: 'F5F5F5',
    }));

    questions.forEach((question, index) => {
        body.push(textParagraph(`第 ${index + 1} 题　题号 ${question.id}`, {
            bold: true, color: '111111', size: 24, before: index ? 280 : 100, after: 60, keepNext: true,
        }));
        body.push(textParagraph(`${question.typeText} · ${question.chapter}`, {
            color: '666666', size: 18, after: 80, keepNext: true,
        }));
        body.push(textParagraph(question.question, { bold: true, size: 23, after: 120 }));

        question.options.forEach((option) => {
            body.push(textParagraph(`${option.key}. ${option.text}`, {
                indent: 240, size: 20, after: 45,
            }));
        });

        body.push(textParagraph(`正确答案：${formatAnswer(question)}`, {
            bold: true, color: '111111', size: 21, before: 100, after: 70,
        }));
        body.push(textParagraph(`解题思路：${question.solution}`, {
            color: '333333', size: 20, after: 80,
        }));
        body.push(textParagraph('选项解析', {
            bold: true, color: '111111', size: 20, before: 80, after: 40,
        }));
        question.options.forEach((option) => {
            const correct = question.answer.indexOf(option.key) !== -1;
            const explanation = (question.optionAnalysis && question.optionAnalysis[option.key]) || '';
            body.push(textParagraph(`${option.key}【${correct ? '正确' : '错误'}】${explanation}`, {
                indent: 240, size: 18, after: 40, color: correct ? '111111' : '666666',
            }));
        });
        if (question.memoryTip) {
            body.push(textParagraph(`记忆小注：${question.memoryTip}`, {
                color: '111111', size: 19, before: 80, after: 60, shading: 'F5F5F5',
            }));
        }
        body.push(textParagraph('————————————————————————', {
            align: 'center', color: 'CCCCCC', size: 16, after: 40,
        }));
    });

    body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1100" w:bottom="1200" w:left="1100" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body.join('')}</w:body>
</w:document>`;
}

function buildStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="宋体"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="宋体"/><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>`;
}

function buildContentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildRootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildDocx(questions, metaOptions) {
    const date = (metaOptions && metaOptions.date) || new Date();
    const meta = Object.assign({
        title: '思政练习生导出',
        date,
    }, metaOptions || {});
    const documentXml = buildDocumentXml(questions, meta);
    const files = [
        { name: '[Content_Types].xml', data: buildContentTypesXml() },
        { name: '_rels/.rels', data: buildRootRelsXml() },
        { name: 'word/document.xml', data: documentXml },
        { name: 'word/styles.xml', data: buildStylesXml() },
        { name: 'word/_rels/document.xml.rels', data: buildDocumentRelsXml() },
    ];
    return {
        buffer: createZip(files, date).buffer,
        documentXml,
        fileName: buildFileName(meta.filePrefix, date),
        questionCount: questions.length,
        mimeType: DOCX_MIME,
    };
}

function saveDocxFile(questions, metaOptions) {
    return new Promise((resolve, reject) => {
        if (!questions || !questions.length) {
            reject(new Error('没有可导出的题目'));
            return;
        }
        let generated;
        try {
            generated = buildDocx(questions, metaOptions);
        } catch (error) {
            reject(error);
            return;
        }
        const filePath = `${wx.env.USER_DATA_PATH}/${generated.fileName}`;
        wx.getFileSystemManager().writeFile({
            filePath,
            data: generated.buffer,
            success: () => resolve({
                filePath,
                fileName: generated.fileName,
                questionCount: generated.questionCount,
            }),
            fail: reject,
        });
    });
}

module.exports = {
    buildDocx,
    saveDocxFile,
    formatDate,
};
