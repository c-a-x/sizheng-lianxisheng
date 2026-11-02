const { questions } = require('./question.js');

const FORMAT = 'new-thought-quiz-learning-backup';
const VERSION = 1;
const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const MAX_SESSIONS = 20;
const SESSION_MODES = ['sequence', 'random', 'single', 'multiple', 'chapter', 'catalog', 'wrong', 'favorite', 'search', 'exam-review'];

const questionMap = questions.reduce((map, question) => {
    map[question.id] = question;
    return map;
}, {});
const validQuestionIds = new Set(questions.map((question) => question.id));

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeNumber(value, fallback, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function safeTime(value) {
    return safeNumber(value, 0, 0, Number.MAX_SAFE_INTEGER);
}

function isSafeSessionId(id) {
    return /^[A-Za-z0-9_-]{1,64}$/.test(id)
        && id !== '__proto__'
        && id !== 'prototype'
        && id !== 'constructor';
}

function uniqueQuestionIds(ids) {
    const seen = new Set();
    return (Array.isArray(ids) ? ids : []).filter((id) => {
        const numericId = Number(id);
        if (!validQuestionIds.has(numericId) || seen.has(numericId)) return false;
        seen.add(numericId);
        return true;
    }).map(Number);
}

function cleanAnswer(questionId, answer) {
    const question = questionMap[questionId];
    if (!question || !Array.isArray(answer)) return [];
    const allowed = new Set(question.options.map((option) => option.key));
    return answer.filter((key, index) => allowed.has(key) && answer.indexOf(key) === index);
}

function cleanAnswers(questionIds, answers) {
    const ids = new Set(questionIds);
    const result = {};
    if (!isObject(answers)) return result;
    Object.keys(answers).forEach((id) => {
        const numericId = Number(id);
        if (!ids.has(numericId)) return;
        result[numericId] = cleanAnswer(numericId, answers[id]);
    });
    return result;
}

function cleanBooleanMap(questionIds, source) {
    const ids = new Set(questionIds);
    const result = {};
    if (!isObject(source)) return result;
    Object.keys(source).forEach((id) => {
        const numericId = Number(id);
        if (ids.has(numericId) && source[id]) result[numericId] = true;
    });
    return result;
}

function sanitizeState(raw) {
    if (!isObject(raw)) return null;
    const state = {
        version: VERSION,
        records: {},
        wrong: {},
        favorites: {},
        slashed: {},
        sessions: {},
        latestSessionId: '',
    };

    if (isObject(raw.records)) {
        Object.keys(raw.records).forEach((id) => {
            const questionId = Number(id);
            if (!validQuestionIds.has(questionId)) return;
            const source = raw.records[id];
            if (!isObject(source)) return;
            const attempts = safeNumber(source.attempts, 0, 0, 1000000);
            if (!attempts) return;
            state.records[questionId] = {
                attempts,
                correct: safeNumber(source.correct, 0, 0, attempts),
                lastAnswer: cleanAnswer(questionId, source.lastAnswer),
                lastCorrect: !!source.lastCorrect,
                updatedAt: safeTime(source.updatedAt),
            };
        });
    }

    if (isObject(raw.wrong)) {
        Object.keys(raw.wrong).forEach((id) => {
            const questionId = Number(id);
            if (validQuestionIds.has(questionId) && raw.wrong[id]) {
                state.wrong[questionId] = true;
            }
        });
    }

    if (isObject(raw.favorites)) {
        Object.keys(raw.favorites).forEach((id) => {
            const questionId = Number(id);
            if (!validQuestionIds.has(questionId) || !raw.favorites[id]) return;
            state.favorites[questionId] = safeTime(raw.favorites[id]) || true;
        });
    }

    if (isObject(raw.slashed)) {
        Object.keys(raw.slashed).forEach((id) => {
            const questionId = Number(id);
            if (!validQuestionIds.has(questionId) || !raw.slashed[id]) return;
            state.slashed[questionId] = safeTime(raw.slashed[id]) || true;
        });
    }

    const sessionList = [];
    const sessionIds = new Set();
    if (isObject(raw.sessions)) {
        Object.keys(raw.sessions).forEach((key) => {
            const source = raw.sessions[key];
            if (!isObject(source)) return;
            const sessionId = String(source.id || key);
            if (!isSafeSessionId(sessionId) || sessionIds.has(sessionId)) return;
            const questionIds = uniqueQuestionIds(source.questionIds);
            if (!questionIds.length) return;
            sessionIds.add(sessionId);
            sessionList.push({
                id: sessionId,
                mode: SESSION_MODES.indexOf(source.mode) !== -1 ? source.mode : 'catalog',
                title: String(source.title || '学习记录').slice(0, 100),
                questionIds,
                currentIndex: safeNumber(source.currentIndex, 0, 0, questionIds.length - 1),
                answers: cleanAnswers(questionIds, source.answers),
                results: cleanBooleanMap(questionIds, source.results),
                submitted: cleanBooleanMap(questionIds, source.submitted),
                completed: !!source.completed,
                createdAt: safeTime(source.createdAt),
                updatedAt: safeTime(source.updatedAt),
            });
        });
    }
    sessionList
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SESSIONS)
        .forEach((session) => {
            state.sessions[session.id] = session;
        });
    const latestSessionId = typeof raw.latestSessionId === 'string' ? raw.latestSessionId : '';
    if (isSafeSessionId(latestSessionId)
        && Object.prototype.hasOwnProperty.call(state.sessions, latestSessionId)
        && !state.sessions[latestSessionId].completed) {
        state.latestSessionId = latestSessionId;
    } else {
        const latest = Object.keys(state.sessions)
            .map((id) => state.sessions[id])
            .filter((session) => !session.completed)
            .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        state.latestSessionId = latest ? latest.id : (Object.keys(state.sessions)[0] || '');
    }

    return state;
}

function getStateSummary(state) {
    const sessions = state && isObject(state.sessions) ? state.sessions : {};
    return {
        totalQuestions: questions.length,
        practiced: state && isObject(state.records) ? Object.keys(state.records).length : 0,
        wrong: state && isObject(state.wrong) ? Object.keys(state.wrong).length : 0,
        favorites: state && isObject(state.favorites) ? Object.keys(state.favorites).length : 0,
        sessions: Object.keys(sessions).length,
        resumeSessions: Object.keys(sessions).filter((id) => !sessions[id].completed).length,
    };
}

function buildBackup(state, date) {
    const cleanState = sanitizeState(state);
    if (!cleanState) throw new Error('学习数据格式无效');
    const exportedAt = (date || new Date()).toISOString();
    const summary = getStateSummary(cleanState);
    const payload = {
        format: FORMAT,
        version: VERSION,
        app: '思政练习生',
        exportedAt,
        summary,
        state: cleanState,
    };
    return {
        text: JSON.stringify(payload, null, 2),
        payload,
        state: cleanState,
        summary,
        exportedAt,
    };
}

function utf8ByteLength(text) {
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else if (code >= 0xD800 && code <= 0xDBFF) {
            bytes += 4;
            index += 1;
        } else bytes += 3;
    }
    return bytes;
}

function validateBackupText(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return { ok: false, error: '文件内容为空' };
    }
    if (utf8ByteLength(text) > MAX_BACKUP_BYTES) {
        return { ok: false, error: '备份文件超过 2MB，无法导入' };
    }
    let payload;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        return { ok: false, error: '文件不是有效的 JSON 备份' };
    }
    if (!isObject(payload) || payload.format !== FORMAT) {
        return { ok: false, error: '这不是「思政练习生」的学习档案' };
    }
    if (payload.version !== VERSION) {
        return { ok: false, error: `备份版本 ${payload.version || '未知'} 不受支持` };
    }
    const state = sanitizeState(payload.state);
    if (!state) {
        return { ok: false, error: '备份中的学习数据不完整' };
    }
    return {
        ok: true,
        state,
        summary: getStateSummary(state),
        exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : '',
        app: typeof payload.app === 'string' ? payload.app : '思政练习生',
    };
}

function pad(value) {
    return value < 10 ? `0${value}` : `${value}`;
}

function makeBackupFileName(date) {
    const value = date || new Date();
    return `思政练习生学习档案_${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}_${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}.json`;
}

function writeBackupFileSync(state, date) {
    const generated = buildBackup(state, date);
    const fileName = makeBackupFileName(date);
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    wx.getFileSystemManager().writeFileSync(filePath, generated.text, 'utf8');
    return {
        filePath,
        fileName,
        text: generated.text,
        summary: generated.summary,
        exportedAt: generated.exportedAt,
    };
}

module.exports = {
    FORMAT,
    VERSION,
    MAX_BACKUP_BYTES,
    buildBackup,
    validateBackupText,
    sanitizeState,
    getStateSummary,
    makeBackupFileName,
    writeBackupFileSync,
};
