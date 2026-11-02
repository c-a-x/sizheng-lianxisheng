const { getChapters } = require('./question.js');

const FILTER_KEYS = ['all', 'undone', 'wrong', 'favorite', 'slashed'];
const FILTER_LABELS = {
    all: '全部',
    undone: '未做',
    wrong: '错题',
    favorite: '收藏',
    slashed: '已斩',
};

function compact(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalize(text) {
    return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function makeSummary(question) {
    const text = compact(question);
    const characters = Array.from(text);
    return characters.length > 45 ? `${characters.slice(0, 45).join('')}…` : text;
}

function matchesKeyword(question, keyword) {
    const value = normalize(keyword);
    if (!value) return true;
    if (/^\d+$/.test(value)) {
        return String(question.id) === value;
    }
    return normalize(question.question).indexOf(value) !== -1
        || normalize(question.chapter).indexOf(value) !== -1;
}

function matchesFilter(question, state, filter) {
    const done = !!state.records[question.id];
    if (filter === 'undone') return !done;
    if (filter === 'wrong') return !!state.wrong[question.id];
    if (filter === 'favorite') return !!state.favorites[question.id];
    if (filter === 'slashed') return !!state.slashed[question.id];
    return true;
}

function buildQuestionItem(question, state, activeSession) {
    const done = !!state.records[question.id];
    const wrong = !!state.wrong[question.id];
    const favorite = !!state.favorites[question.id];
    const slashed = !!state.slashed[question.id];
    const currentId = activeSession
        ? activeSession.questionIds[activeSession.currentIndex]
        : null;
    return {
        id: question.id,
        typeText: question.typeText,
        summary: makeSummary(question.question),
        chapter: question.chapter,
        statusText: slashed ? '已斩' : (wrong ? '错题' : (done ? '已做' : '未做')),
        statusClass: slashed ? 'status-slashed' : (wrong ? 'status-wrong' : (done ? 'status-done' : 'status-undone')),
        isSlashed: slashed,
        isFavorite: favorite,
        isCurrent: question.id === currentId,
        isSelected: false,
    };
}

function buildCatalog(config) {
    const state = config.state || {};
    state.records = state.records || {};
    state.wrong = state.wrong || {};
    state.favorites = state.favorites || {};
    const filter = FILTER_KEYS.indexOf(config.filter) !== -1 ? config.filter : 'all';
    const keyword = config.keyword || '';
    const expanded = config.expanded || {};
    const activeSession = config.activeSession || null;
    const chapters = getChapters(config.subject);
    const allQuestions = chapters.reduce((all, chapter) => all.concat(chapter.questions), []);
    const doneCount = allQuestions.filter((question) => state.records[question.id]).length;
    const filterCounts = {
        all: allQuestions.length,
        undone: allQuestions.length - doneCount,
        wrong: allQuestions.filter((question) => state.wrong[question.id]).length,
        favorite: allQuestions.filter((question) => state.favorites[question.id]).length,
        slashed: allQuestions.filter((question) => state.slashed[question.id]).length,
    };
    const filters = FILTER_KEYS.map((key) => ({
        key,
        label: FILTER_LABELS[key],
        count: filterCounts[key],
        active: key === filter,
    }));
    const visibleQuestions = [];
    const visibleChapters = [];

    chapters.forEach((chapter) => {
        const matched = chapter.questions.filter((question) => (
            matchesFilter(question, state, filter) && matchesKeyword(question, keyword)
        ));
        if (!matched.length) return;
        const done = chapter.questions.filter((question) => state.records[question.id]).length;
        const wrong = chapter.questions.filter((question) => state.wrong[question.id]).length;
        const items = matched.map((question) => buildQuestionItem(question, state, activeSession));
        visibleQuestions.push(...matched);
        visibleChapters.push({
            name: chapter.name,
            total: chapter.total,
            done,
            wrong,
            matched: matched.length,
            progress: Math.round((done / chapter.total) * 100),
            isExpanded: !!expanded[chapter.name],
            questions: items,
        });
    });

    return {
        total: allQuestions.length,
        filters,
        filterCounts,
        filteredCount: visibleQuestions.length,
        chapters: visibleChapters,
        visibleQuestions,
    };
}

module.exports = {
    FILTER_KEYS,
    buildCatalog,
    makeSummary,
};
