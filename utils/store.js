const { isCorrect } = require('./question.js');

const STORAGE_KEY = 'sizheng_quiz_state_v1';
const SUBJECT_KEY = 'sizheng_subject_v1';

function emptyState() {
    return {
        version: 1,
        records: {},
        wrong: {},
        favorites: {},
        slashed: {},
        sessions: {},
        latestSessionId: '',
    };
}

function load() {
    try {
        const saved = wx.getStorageSync(STORAGE_KEY);
        if (!saved || typeof saved !== 'object') return emptyState();
        return Object.assign(emptyState(), saved, {
            records: saved.records || {},
            wrong: saved.wrong || {},
            favorites: saved.favorites || {},
            slashed: saved.slashed || {},
            sessions: saved.sessions || {},
        });
    } catch (error) {
        return emptyState();
    }
}

function save(state) {
    try {
        wx.setStorageSync(STORAGE_KEY, state);
        return true;
    } catch (error) {
        wx.showToast({ title: '本地记录保存失败', icon: 'none' });
        return false;
    }
}

function createSession(config) {
    const questions = config.questions || [];
    if (!questions.length) return null;
    const state = load();
    const id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const session = {
        id,
        mode: config.mode,
        title: config.title,
        questionIds: questions.map((question) => question.id),
        currentIndex: 0,
        answers: config.answers || {},
        results: config.results || {},
        submitted: config.submitted || {},
        completed: false,
        createdAt: now,
        updatedAt: now,
    };
    state.sessions[id] = session;
    state.latestSessionId = id;

    const sessionIds = Object.keys(state.sessions);
    if (sessionIds.length > 20) {
        sessionIds
            .map((sessionId) => state.sessions[sessionId])
            .filter((item) => item.completed && item.id !== id)
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, sessionIds.length - 20)
            .forEach((item) => delete state.sessions[item.id]);
    }

    save(state);
    return session;
}

function getSession(id) {
    const state = load();
    return state.sessions[id] || null;
}

function getLatestSession() {
    const state = load();
    const latest = state.sessions[state.latestSessionId];
    if (latest && !latest.completed) return latest;
    return Object.keys(state.sessions)
        .map((id) => state.sessions[id])
        .filter((session) => !session.completed && session.mode !== 'exam-review')
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

function setSessionIndex(id, currentIndex) {
    const state = load();
    const session = state.sessions[id];
    if (!session) return;
    session.currentIndex = currentIndex;
    session.updatedAt = Date.now();
    state.latestSessionId = id;
    save(state);
}

function answerQuestion(sessionId, question, answer, correct) {
    const state = load();
    const id = question.id;
    const session = state.sessions[sessionId];
    if (!session || session.submitted[id]) return;

    session.answers[id] = answer;
    session.results[id] = correct;
    session.submitted[id] = true;
    session.updatedAt = Date.now();
    state.latestSessionId = sessionId;

    const record = state.records[id] || { attempts: 0, correct: 0 };
    record.attempts += 1;
    record.correct += correct ? 1 : 0;
    record.lastAnswer = answer;
    record.lastCorrect = correct;
    record.updatedAt = Date.now();
    state.records[id] = record;

    if (correct) {
        delete state.wrong[id];
    } else {
        state.wrong[id] = true;
    }
    save(state);
}

function completeSession(id) {
    const state = load();
    const session = state.sessions[id];
    if (!session) return;
    session.completed = true;
    session.updatedAt = Date.now();
    save(state);
}

function replaceState(nextState) {
    if (!nextState || typeof nextState !== 'object') return false;
    const state = emptyState();
    state.records = nextState.records || {};
    state.wrong = nextState.wrong || {};
    state.favorites = nextState.favorites || {};
    state.sessions = nextState.sessions || {};
    state.latestSessionId = nextState.latestSessionId || '';
    return save(state);
}

function clearAll() {
    try {
        wx.removeStorageSync(STORAGE_KEY);
        return true;
    } catch (error) {
        wx.showToast({ title: '清除学习记录失败', icon: 'none' });
        return false;
    }
}

function toggleFavorite(questionId) {
    const state = load();
    if (state.favorites[questionId]) {
        delete state.favorites[questionId];
    } else {
        state.favorites[questionId] = Date.now();
    }
    save(state);
    return !!state.favorites[questionId];
}

function toggleSlash(questionId) {
    const state = load();
    if (state.slashed[questionId]) {
        delete state.slashed[questionId];
    } else {
        state.slashed[questionId] = Date.now();
        delete state.wrong[questionId];
    }
    save(state);
    return !!state.slashed[questionId];
}

function getSubjectId() {
    try {
        const saved = wx.getStorageSync(SUBJECT_KEY);
        return typeof saved === 'string' ? saved : '';
    } catch (error) {
        return '';
    }
}

function setSubjectId(subjectId) {
    try {
        wx.setStorageSync(SUBJECT_KEY, subjectId);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    load,
    getSubjectId,
    setSubjectId,
    createSession,
    getSession,
    getLatestSession,
    setSessionIndex,
    answerQuestion,
    completeSession,
    replaceState,
    clearAll,
    toggleFavorite,
    toggleSlash,
};
