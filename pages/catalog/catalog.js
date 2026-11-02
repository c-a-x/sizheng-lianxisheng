const { buildCatalog } = require('../../utils/catalog.js');
const { getSubject, subjects, DEFAULT_SUBJECT } = require('../../utils/question.js');
const { saveDocxFile } = require('../../utils/export.js');
const store = require('../../utils/store.js');
const appearance = require('../../utils/appearance.js');
const { scrollPageTo, setTitle } = require('../../utils/ui.js');

const CATALOG_UI_KEY = 'sizheng_catalog_ui_v1';
const PENDING_JUMP_KEY = 'sizheng_catalog_jump_v1';
const VALID_FILTERS = ['all', 'undone', 'wrong', 'favorite', 'slashed'];
const EMPTY_COPY = {
    slashed: ['还没有斩过的题', '在答题页点右上角「斩」，把已掌握的题移出练习'],
    wrong: ['错题本是空的', '答错的题会自动收进来，重练答对后移出'],
    favorite: ['还没有收藏题目', '答题页点「☆」收藏，方便回头再看'],
    undone: ['这个学科已经全部做过了', '切到「全部」可以回顾做过的题'],
};
const CATALOG_CONTEXT_KEY = 'sizheng_catalog_context_v1';

function defaultUiState() {
    return {
        filter: 'all',
        keyword: '',
        expanded: {},
        scrollTop: 0,
    };
}

Page({
    data: {
        subjects: subjects.map((subject) => ({ id: subject.id, short: subject.short, total: subject.total })),
        subjectId: DEFAULT_SUBJECT,
        subjectShort: '',
        subjectTotal: 0,
        total: 392,
        filters: [],
        filteredCount: 0,
        chapters: [],
        keyword: '',
        filter: 'all',
        isEmpty: false,
        emptyTitle: '没有符合条件的题目',
        emptyHint: '换个题号、关键词或筛选条件试试',
        activeSessionTitle: '',
        activeSessionProgress: '',
        wrongTotal: 0,
        selectionMode: false,
        selectedCount: 0,
        allVisibleSelected: false,
        exporting: false,
        appearanceClass: 'theme-paper size-m',
        rootStyle: '',
    },

    onLoad(options) {
        let context = null;
        try { context = wx.getStorageSync(CATALOG_CONTEXT_KEY); } catch (error) { context = null; }
        this.activeSessionId = (options && options.session) || (context && context.sessionId) || '';
        this.subjectId = (options && options.subject) || store.getSubjectId() || DEFAULT_SUBJECT;
        this.subject = getSubject(this.subjectId);
        this.subjectQuestions = this.subject.questions;
        this.selectedMap = {};
        const saved = this.loadUiState();
        this.uiState = saved;
        const session = this.activeSessionId ? store.getSession(this.activeSessionId) : null;
        this.setData({
            filter: saved.filter,
            keyword: saved.keyword,
            activeSessionTitle: session ? session.title : '',
            activeSessionProgress: session ? `${session.currentIndex + 1} / ${session.questionIds.length}` : '',
        });
        setTitle('题库');
        this.setData({ subjectId: this.subjectId, subjectShort: this.subject.short, subjectTotal: this.subject.total });
        this.buildView();
        this.hasShown = true;
        this.restoreScroll(saved.scrollTop);
    },

    syncSessionContext() {
        let context = null;
        try { context = wx.getStorageSync(CATALOG_CONTEXT_KEY); } catch (error) { context = null; }
        const sessionId = (context && context.sessionId) || '';
        if (sessionId === this.activeSessionId) return;
        this.activeSessionId = sessionId;
        const session = sessionId ? store.getSession(sessionId) : null;
        this.setData({
            activeSessionTitle: session ? session.title : '',
            activeSessionProgress: session ? `${session.currentIndex + 1} / ${session.questionIds.length}` : '',
        });
        this.buildView();
    },

    switchSubject(event) {
        const subjectId = event.currentTarget.dataset.id;
        if (!subjectId || subjectId === this.subjectId) return;
        store.setSubjectId(subjectId);
        this.subjectId = subjectId;
        this.subject = getSubject(subjectId);
        this.subjectQuestions = this.subject.questions;
        this.activeSessionId = '';
        this.visibleQuestions = [];
        this.selectedMap = {};
        this.uiState = Object.assign({}, this.uiState, { expanded: {} });
        wx.setNavigationBarTitle({ title: '题库' });
        this.setData({
            subjectId,
            subjectShort: this.subject.short,
            subjectTotal: this.subject.total,
            activeSessionTitle: '',
            activeSessionProgress: '',
            selectionMode: false,
            selectedCount: 0,
        });
        this.buildView();
        wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    },

    onShow() {
        this.setData({
            appearanceClass: appearance.classes(),
            rootStyle: appearance.rootStyle(),
        });
        appearance.applyChrome();
        if (!this.hasShown) return;
        this.syncSessionContext();
        const session = this.activeSessionId ? store.getSession(this.activeSessionId) : null;
        if (session) {
            this.setData({
                activeSessionTitle: session.title,
                activeSessionProgress: `${session.currentIndex + 1} / ${session.questionIds.length}`,
            });
        }
        this.buildView();
    },

    loadUiState() {
        try {
            const saved = wx.getStorageSync(CATALOG_UI_KEY);
            if (!saved || typeof saved !== 'object') return defaultUiState();
            return {
                filter: VALID_FILTERS.indexOf(saved.filter) !== -1 ? saved.filter : 'all',
                keyword: typeof saved.keyword === 'string' ? saved.keyword : '',
                expanded: saved.expanded && typeof saved.expanded === 'object' ? saved.expanded : {},
                scrollTop: Number(saved.scrollTop) || 0,
            };
        } catch (error) {
            return defaultUiState();
        }
    },

    saveUiState() {
        try {
            wx.setStorageSync(CATALOG_UI_KEY, this.uiState);
        } catch (error) {
            // 目录筛选属于辅助状态，存储失败不影响题目浏览。
        }
    },

    buildView(callback) {
        const session = this.activeSessionId ? store.getSession(this.activeSessionId) : null;
        const result = buildCatalog({
            subject: this.subjectId,
            state: store.load(),
            filter: this.uiState.filter,
            keyword: this.uiState.keyword,
            expanded: this.uiState.expanded,
            activeSession: session,
        });
        this.visibleQuestions = result.visibleQuestions;
        const chapters = this.decorateChapters(result.chapters);
        const selectedCount = Object.keys(this.selectedMap).length;
        const allVisibleSelected = result.visibleQuestions.length > 0
            && result.visibleQuestions.every((question) => this.selectedMap[question.id]);
        const emptyCopy = this.uiState.keyword
            ? ['没搜到匹配的题目', '换个题号或关键词试试']
            : (EMPTY_COPY[this.uiState.filter] || ['没有符合条件的题目', '换个题号、关键词或筛选条件试试']);
        this.setData({
            emptyTitle: emptyCopy[0],
            emptyHint: emptyCopy[1],
            total: result.total,
            filters: result.filters,
            filteredCount: result.filteredCount,
            chapters,
            isEmpty: result.filteredCount === 0,
            wrongTotal: result.filterCounts.wrong,
            selectedCount,
            allVisibleSelected,
        }, callback);
    },

    decorateChapters(chapters) {
        if (!this.data.selectionMode) return chapters;
        return chapters.map((chapter) => Object.assign({}, chapter, {
            questions: chapter.questions.map((question) => Object.assign({}, question, {
                isSelected: !!this.selectedMap[question.id],
            })),
        }));
    },

    refreshSelectionView() {
        const selectedCount = Object.keys(this.selectedMap).length;
        const allVisibleSelected = this.visibleQuestions.length > 0
            && this.visibleQuestions.every((question) => this.selectedMap[question.id]);
        this.setData({
            chapters: this.decorateChapters(this.data.chapters),
            selectedCount,
            allVisibleSelected,
        });
    },

    cancelSelection() {
        if (!this.data.selectionMode) return;
        this.selectedMap = {};
        this.setData({
            selectionMode: false,
            selectedCount: 0,
            allVisibleSelected: false,
        });
    },

    toggleSelectionMode() {
        const selectionMode = !this.data.selectionMode;
        this.selectedMap = {};
        this.setData({
            selectionMode,
            selectedCount: 0,
            allVisibleSelected: false,
        }, () => {
            this.buildView();
        });
    },

    handleQuestionTap(event) {
        const questionId = Number(event.currentTarget.dataset.id);
        if (!this.data.selectionMode) {
            this.selectQuestion(event);
            return;
        }
        if (this.selectedMap[questionId]) {
            delete this.selectedMap[questionId];
        } else {
            this.selectedMap[questionId] = true;
        }
        this.refreshSelectionView();
    },

    restoreQuestion(event) {
        const questionId = Number(event.currentTarget.dataset.id);
        if (!questionId) return;
        store.toggleSlash(questionId);
        this.buildView();
        wx.showToast({ title: '已恢复本题', icon: 'none' });
    },

    toggleSelectAllVisible() {
        if (!this.visibleQuestions.length) return;
        const allSelected = this.visibleQuestions.every((question) => this.selectedMap[question.id]);
        if (allSelected) {
            this.selectedMap = {};
        } else {
            this.visibleQuestions.forEach((question) => {
                this.selectedMap[question.id] = true;
            });
        }
        this.refreshSelectionView();
    },

    getSelectedQuestions() {
        return this.subjectQuestions.filter((question) => this.selectedMap[question.id]);
    },

    exportWrongQuestions() {
        const state = store.load();
        const wrongQuestions = this.subjectQuestions.filter((question) => state.wrong[question.id]);
        if (!wrongQuestions.length) {
            wx.showToast({ title: '当前没有错题可导出', icon: 'none' });
            return;
        }
        this.runExport(wrongQuestions, '思政练习生错题', '思政练习生错题');
    },

    exportSelectedQuestions() {
        if (!this.data.selectionMode) return;
        const selected = this.getSelectedQuestions();
        if (!selected.length) {
            wx.showToast({ title: '请先选择题目', icon: 'none' });
            return;
        }
        this.runExport(selected, '思政练习生自选题目', '思政练习生自选题目');
    },

    runExport(questions, title, filePrefix) {
        if (this.data.exporting) return;
        this.setData({ exporting: true });
        this.exporting = true;
        wx.showLoading({ title: '正在生成文档', mask: true });
        saveDocxFile(questions, {
            title,
            filePrefix,
            date: new Date(),
        }).then((file) => {
            wx.hideLoading();
            this.setData({ exporting: false });
            this.exporting = false;
            wx.showModal({
                title: 'Word 文档已生成',
                content: `共 ${file.questionCount} 道题，含答案、选项解析和记忆小注。打开后可直接转发，也可在 WPS/Word 中另存为 PDF。`,
                confirmText: '打开文档',
                cancelText: '稍后',
                success: (result) => {
                    if (!result.confirm) return;
                    wx.openDocument({
                        filePath: file.filePath,
                        fileType: 'docx',
                        showMenu: true,
                        fail: () => {
                            wx.showToast({ title: '文档打开失败，请重试', icon: 'none' });
                        },
                    });
                },
            });
        }).catch(() => {
            wx.hideLoading();
            this.setData({ exporting: false });
            this.exporting = false;
            wx.showToast({ title: 'Word 文档生成失败', icon: 'none' });
        });
    },

    handleSearchInput(event) {
        const keyword = event.detail.value;
        this.cancelSelection();
        this.uiState.keyword = keyword;
        this.uiState.scrollTop = 0;
        this.saveUiState();
        this.setData({ keyword }, () => {
            this.buildView();
            scrollPageTo(0, 0);
        });
    },

    clearSearch() {
        this.cancelSelection();
        this.uiState.keyword = '';
        this.uiState.scrollTop = 0;
        this.saveUiState();
        this.setData({ keyword: '' }, () => {
            this.buildView();
            scrollPageTo(0, 0);
        });
    },

    selectFilter(event) {
        const filter = event.currentTarget.dataset.filter;
        if (VALID_FILTERS.indexOf(filter) === -1 || filter === this.uiState.filter) return;
        this.cancelSelection();
        this.uiState.filter = filter;
        this.uiState.scrollTop = 0;
        this.saveUiState();
        this.setData({ filter }, () => {
            this.buildView();
            scrollPageTo(0, 0);
        });
    },

    resetDirectory() {
        this.cancelSelection();
        this.uiState.filter = 'all';
        this.uiState.keyword = '';
        this.uiState.scrollTop = 0;
        this.saveUiState();
        this.setData({ filter: 'all', keyword: '' }, () => {
            this.buildView();
            scrollPageTo(0, 0);
        });
    },

    toggleChapter(event) {
        const name = event.currentTarget.dataset.name;
        const nextExpanded = !this.uiState.expanded[name];
        if (nextExpanded) {
            this.uiState.expanded[name] = true;
        } else {
            delete this.uiState.expanded[name];
        }
        this.saveUiState();
        const chapters = this.data.chapters.map((chapter) => {
            if (chapter.name !== name) return chapter;
            return Object.assign({}, chapter, { isExpanded: nextExpanded });
        });
        this.setData({ chapters });
    },

    selectQuestion(event) {
        const questionId = Number(event.currentTarget.dataset.id);
        const session = this.activeSessionId ? store.getSession(this.activeSessionId) : null;
        this.saveUiState();

        if (session && session.questionIds.indexOf(questionId) !== -1) {
            try {
                wx.setStorageSync(PENDING_JUMP_KEY, {
                    sessionId: session.id,
                    questionId,
                });
            } catch (error) {
                wx.showToast({ title: '跳题状态保存失败', icon: 'none' });
                return;
            }
            wx.navigateTo({ url: `/pages/practice/practice?session=${session.id}` });
            return;
        }

        this.startCatalogPractice(questionId);
    },

    startCatalogPractice(questionId) {
        const index = this.visibleQuestions.findIndex((question) => question.id === questionId);
        if (index === -1) return;
        const titleMap = {
            undone: '未做题目录',
            wrong: '错题目录',
            favorite: '收藏目录',
        };
        let title = '题库目录练习';
        if (this.uiState.keyword) {
            title = '目录搜索练习';
        } else if (titleMap[this.uiState.filter]) {
            title = titleMap[this.uiState.filter];
        }
        const session = store.createSession({
            mode: 'catalog',
            title,
            questions: this.visibleQuestions,
        });
        if (!session) return;
        store.setSessionIndex(session.id, index);
        wx.navigateTo({ url: `/pages/practice/practice?session=${session.id}` });
    },

    restoreScroll(scrollTop) {
        if (!scrollTop) return;
        setTimeout(() => {
            scrollPageTo(scrollTop, 0);
        }, 80);
    },

    onPageScroll(event) {
        this.uiState.scrollTop = event.scrollTop;
    },

    onHide() {
        this.saveUiState();
    },

    onUnload() {
        this.saveUiState();
    },
});
