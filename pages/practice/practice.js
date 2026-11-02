const {
    getByIds,
    normalizeAnswer,
    isCorrect,
    formatAnswer,
    shuffle,
} = require('../../utils/question.js');
const store = require('../../utils/store.js');
const appearance = require('../../utils/appearance.js');
const prefs = require('../../utils/prefs.js');
const { scrollPageTo, setTitle } = require('../../utils/ui.js');

const PENDING_JUMP_KEY = 'sizheng_catalog_jump_v1';
const CATALOG_CONTEXT_KEY = 'sizheng_catalog_context_v1';

Page({
    data: {
        loading: true,
        empty: false,
        finished: false,
        title: '',
        mode: '',
        reviewMode: false,
        current: null,
        viewOptions: [],
        currentIndex: 0,
        total: 0,
        selected: [],
        submitted: false,
        correct: false,
        hasAnswer: false,
        feedbackTitle: '',
        correctText: '',
        userAnswerText: '',
        favorite: false,
        answeredCount: 0,
        progress: 0,
        canPrev: false,
        isLast: false,
        sessionCorrect: 0,
        sessionWrong: 0,
        sessionUnanswered: 0,
        appearanceClass: 'theme-paper size-m',
        rootStyle: '',
        questionFontSize: 31,
        optionFontSize: 27,
        analysisFontSize: 24,
        showExplanation: false,
        slashed: false,
        hideNav: false,
        autoNext: true,
        recite: false,
    },

    onLoad(options) {
        const session = store.getSession(options.session);
        if (!session) {
            this.setData({ loading: false, empty: true });
            return;
        }
        this.session = session;
        this.questions = getByIds(session.questionIds);
        if (!this.questions.length) {
            this.setData({ loading: false, empty: true });
            return;
        }
        setTitle(session.mode === 'exam-review' ? '答卷解析' : '练习');
        const savedPrefs = prefs.get();
        this.setData({
            loading: false,
            title: session.title,
            mode: session.mode,
            reviewMode: session.mode === 'exam-review',
            total: this.questions.length,
            recite: savedPrefs.recite,
            hideNav: savedPrefs.hideNav,
            autoNext: savedPrefs.autoNext,
        });
        this.renderCurrent();
    },

    onShow() {
        const scale = appearance.fontScale();
        this.setData({
            appearanceClass: appearance.classes(),
            rootStyle: appearance.rootStyle(),
            questionFontSize: scale.question,
            optionFontSize: scale.option,
            analysisFontSize: scale.analysis,
        });
        appearance.applyChrome();
        const practicePrefs = prefs.get();
        const modeChanged = practicePrefs.recite !== this.data.recite;
        this.setData({
            hideNav: practicePrefs.hideNav,
            autoNext: practicePrefs.autoNext,
            recite: practicePrefs.recite,
        });
        if (modeChanged && this.session && this.questions && !this.data.finished && !this.data.empty) {
            this.renderCurrent();
        }
        this.consumeCatalogJump();
    },

    consumeCatalogJump() {
        if (!this.session || !this.questions) return;
        let pending;
        try {
            pending = wx.getStorageSync(PENDING_JUMP_KEY);
        } catch (error) {
            return;
        }
        if (!pending) return;
        wx.removeStorageSync(PENDING_JUMP_KEY);
        if (pending.sessionId !== this.session.id) return;
        const targetIndex = this.questions.findIndex((question) => question.id === Number(pending.questionId));
        if (targetIndex === -1) return;
        store.setSessionIndex(this.session.id, targetIndex);
        this.session.currentIndex = targetIndex;
        this.renderCurrent();
        scrollPageTo(0, 0);
    },

    openCatalog() {
        if (!this.session) return;
        wx.removeStorageSync(PENDING_JUMP_KEY);
        try {
            wx.setStorageSync(CATALOG_CONTEXT_KEY, { sessionId: this.session.id });
        } catch (error) {
            // 上下文写入失败不阻断浏览题库
        }
        wx.switchTab({ url: '/pages/catalog/catalog' });
    },

    buildOptions(question, selected, submitted, recite) {
        return question.options.map((option) => {
            const isSelected = selected.indexOf(option.key) !== -1;
            const isAnswer = question.answer.indexOf(option.key) !== -1;
            let stateClass = isSelected && !recite ? 'option-selected' : '';
            let marker = option.key;
            if ((submitted || recite) && isAnswer) {
                stateClass = 'option-correct';
                marker = '✓';
            } else if (submitted && isSelected) {
                stateClass = 'option-wrong';
                marker = '×';
            }
            const analysis = (question.optionAnalysis && question.optionAnalysis[option.key]) || '';
            return Object.assign({}, option, {
                stateClass,
                marker,
                analysis,
                analysisLabel: isAnswer ? '入选依据' : '排除依据',
            });
        });
    },

    renderCurrent() {
        const session = store.getSession(this.session.id) || this.session;
        this.session = session;
        const currentIndex = Math.max(0, Math.min(session.currentIndex, this.questions.length - 1));
        const current = this.questions[currentIndex];
        const selected = normalizeAnswer(current, session.answers[current.id] || []);
        const submitted = !!session.submitted[current.id];
        const correct = !!session.results[current.id];
        const hasAnswer = selected.length > 0;
        const recite = this.data.recite;
        const state = store.load();
        let feedbackTitle = correct ? '回答正确' : '回答错误';
        if (submitted && !hasAnswer) feedbackTitle = '本题未作答';
        this.setData({
            current,
            currentIndex,
            selected,
            submitted,
            correct,
            hasAnswer,
            feedbackTitle,
            correctText: formatAnswer(current),
            userAnswerText: hasAnswer ? selected.join('、') : '未作答',
            viewOptions: this.buildOptions(current, selected, submitted, recite),
            favorite: !!state.favorites[current.id],
            answeredCount: Object.keys(session.submitted).length,
            progress: Math.round(((currentIndex + 1) / this.questions.length) * 100),
            canPrev: currentIndex > 0,
            isLast: currentIndex === this.questions.length - 1,
            slashed: !!state.slashed[current.id],
            showExplanation: recite,
        });
    },

    selectOption(event) {
        if (this.data.submitted || this.data.reviewMode || this.data.recite) return;
        const key = event.currentTarget.dataset.key;
        const current = this.data.current;
        let selected;
        if (current.type === 'multiple') {
            selected = this.data.selected.slice();
            const selectedIndex = selected.indexOf(key);
            if (selectedIndex === -1) {
                selected.push(key);
            } else {
                selected.splice(selectedIndex, 1);
            }
            selected = normalizeAnswer(current, selected);
            this.setData({
                selected,
                viewOptions: this.buildOptions(current, selected, false),
            });
            return;
        }
        selected = [key];
        this.setData({ selected });
        this.gradeAnswer(selected);
    },

    submitMultiple() {
        if (!this.data.selected.length) {
            wx.showToast({ title: '请至少选择一项', icon: 'none' });
            return;
        }
        this.gradeAnswer(this.data.selected);
    },

    gradeAnswer(answer) {
        if (this.data.submitted) return;
        const current = this.data.current;
        const correct = isCorrect(current, answer);
        store.answerQuestion(this.session.id, current, answer, correct);
        this.session = store.getSession(this.session.id);
        this.renderCurrent();
        this.clearAutoNext();
        if (correct && this.data.autoNext && !this.data.isLast && !this.data.reviewMode) {
            const answeredId = current.id;
            this.autoNextTimer = setTimeout(() => {
                this.autoNextTimer = null;
                if (this.data.current && this.data.current.id === answeredId) this.goNext();
            }, 780);
        }
    },

    switchMode(event) {
        const recite = event.currentTarget.dataset.mode === 'recite';
        if (recite === this.data.recite) return;
        prefs.set({ recite });
        this.setData({ recite });
        this.renderCurrent();
        scrollPageTo(0, 0);
    },

    toggleExplanation() {
        this.setData({ showExplanation: !this.data.showExplanation });
    },

    slashQuestion() {
        const current = this.data.current;
        if (!current) return;
        const slashed = store.toggleSlash(current.id);
        this.setData({ slashed });
        wx.showToast({
            title: slashed ? '已斩，题库可撤销' : '已恢复本题',
            icon: 'none',
        });
        if (slashed && !this.data.isLast) {
            this.clearAutoNext();
            const targetId = current.id;
            setTimeout(() => {
                if (this.data.current && this.data.current.id === targetId) this.goNext();
            }, 420);
        }
    },

    onTouchStart(event) {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        this.touchStart = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    },

    onTouchEnd(event) {
        const start = this.touchStart;
        this.touchStart = null;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!start || !touch) return;
        if (this.data.finished || this.data.empty) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx < 0) {
            this.goNext();
        } else {
            this.goPrevious();
        }
    },

    clearAutoNext() {
        if (this.autoNextTimer) {
            clearTimeout(this.autoNextTimer);
            this.autoNextTimer = null;
        }
    },

    toggleFavorite() {
        const favorite = store.toggleFavorite(this.data.current.id);
        this.setData({ favorite });
        wx.showToast({ title: favorite ? '已收藏' : '已取消收藏', icon: 'none' });
    },

    goPrevious() {
        if (!this.data.canPrev) return;
        this.clearAutoNext();
        const nextIndex = this.data.currentIndex - 1;
        store.setSessionIndex(this.session.id, nextIndex);
        this.session.currentIndex = nextIndex;
        this.renderCurrent();
        scrollPageTo(0, 0);
    },

    goNext() {
        this.clearAutoNext();
        if (this.data.isLast) {
            if (this.data.reviewMode) {
                wx.navigateBack();
            } else {
                this.finishPractice();
            }
            return;
        }
        const nextIndex = this.data.currentIndex + 1;
        store.setSessionIndex(this.session.id, nextIndex);
        this.session.currentIndex = nextIndex;
        this.renderCurrent();
        scrollPageTo(0, 0);
    },

    finishPractice() {
        const session = store.getSession(this.session.id);
        const results = Object.keys(session.results).map((id) => session.results[id]);
        const correct = results.filter(Boolean).length;
        const answered = Object.keys(session.submitted).length;
        store.completeSession(this.session.id);
        this.setData({
            finished: true,
            sessionCorrect: correct,
            sessionWrong: answered - correct,
            sessionUnanswered: this.questions.length - answered,
        });
        scrollPageTo(0, 0);
    },

    restart() {
        const selected = this.data.mode === 'random' ? shuffle(this.questions) : this.questions;
        const session = store.createSession({
            mode: this.data.mode,
            title: this.data.title,
            questions: selected,
        });
        wx.redirectTo({ url: `/pages/practice/practice?session=${session.id}` });
    },

    onHide() {
        this.clearAutoNext();
    },

    onUnload() {
        this.clearAutoNext();
    },

    goHome() {
        wx.reLaunch({ url: '/pages/index/index' });
    },
});
