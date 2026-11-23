/**
 * 题库数据压缩脚本。
 *
 * 存储层瘦身，语义完全不变：
 *   - options 由 [{key,text}] 压成纯文本数组，选项键按顺序推导（A/B/C/…）
 *   - chapter 由章节全名压成编号 c，章节名写在 module.exports.chapters
 *   - 去掉可推导的 typeText（由 type 推导）和未被引用的 source
 *
 * utils/question.js 同时兼容压缩前/后的两种格式，
 * 所以题库重新生成时无需改流程，跑一次本脚本即可。
 *
 * 用法：node scripts/bank/compact_data.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

const FILES = [
    ['data/questions.js', '新思想'],
    ['data/mayuan.js', '马原'],
    ['data/maogai.js', '毛中特'],
];

FILES.forEach(([relative, label]) => {
    const file = path.join(root, relative);
    const list = require(file);
    if (!Array.isArray(list)) {
        console.log(`跳过 ${relative}：已是压缩格式`);
        return;
    }

    const chapters = [];
    const items = list.map((question) => {
        let index = chapters.indexOf(question.chapter);
        if (index === -1) {
            chapters.push(question.chapter);
            index = chapters.length - 1;
        }
        const item = {
            id: question.id,
            type: question.type,
            c: index,
            question: question.question,
            options: question.options.map((option) => (typeof option === 'string' ? option : option.text)),
            answer: question.answer,
        };
        if (question.explanation) item.explanation = question.explanation;
        if (question.score) item.score = question.score;
        return item;
    });

    const text = `// ${label}题库（压缩存储：选项为文本数组，章节用 c 索引，章节名见 chapters）\n`
        + `module.exports = ${JSON.stringify(items)};\n`
        + `module.exports.chapters = ${JSON.stringify(chapters)};\n`;

    fs.writeFileSync(file, text, 'utf8');
    console.log(`${relative}：${list.length} 题 / ${chapters.length} 章 → ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`);
});
