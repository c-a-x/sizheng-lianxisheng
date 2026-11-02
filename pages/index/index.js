const {
    subjects,
    DEFAULT_SUBJECT,
    getSubject,
    shuffle,
} = require('../../utils/question.js');
const store = require('../../utils/store.js');
const appearance = require('../../utils/appearance.js');
const { scrollPageTo } = require('../../utils/ui.js');

Page({
    data: {
        subjects: subjects.map((subject) => ({
            id: subject.id,
            short: subject.short,
            total: subject.total,
        })),
        subjectId: DEFAULT_SUBJECT,
        subjectTitle: '',
        subjectName: '',
        subjectEyebrow: '',
        subjectTag: '',
        total: 0,
        chapterCount: 0,
        annotated: 0,
        practiced: 0,
        progress: 0,
        accuracy: 0,
        wrongCount: 0,
        favoriteCount: 0,
        singleCount: 0,
        multipleCount: 0,
        resumeSession: null,
        appearanceClass: 'theme-paper size-m',
        rootStyle: '',
    },

    onShow() {
        this.applyAppearance();
        this.refresh();
    },

    applyAppearance() {
        this.setData({
            appearanceClass: appearance.classes(),
            rootStyle: appearance.rootStyle(),
        });
        appearance.applyChrome();
    },


    refresh() {
        const saved = store.getSubjectId();
        const subject = getSubject(saved);
        const state = store.load();
        const ids = {};
        subject.questions.forEach((question) => { ids[question.id] = true; });
        const records = Object.keys(state.records)
            .filter((id) => ids[id])
            .map((id) => state.records[id]);
        const attempts = records.reduce((sum, record) => sum + record.attempts, 0);
        const correct = records.reduce((sum, record) => sum + record.correct, 0);
        const practiced = records.length;
        const resumeSession = store.getLatestSession();
        this.setData({
            subjectId: subject.id,
            subjectTitle: subject.title,
            subjectName: subject.name,
            subjectEyebrow: subject.eyebrow,
            subjectTag: subject.tag,
            total: subject.total,
            chapterCount: subject.chapters.length,
            annotated: subject.annotated,
            practiced,
            progress: subject.total ? Math.round((practiced / subject.total) * 100) : 0,
            accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
            singleCount: subject.questions.filter((question) => question.type === 'single').length,
            multipleCount: subject.questions.filter((question) => question.type === 'multiple').length,
            wrongCount: subject.questions.filter((question) => state.wrong[question.id]).length,
            favoriteCount: subject.questions.filter((question) => state.favorites[question.id]).length,
            resumeSession: resumeSession ? {
                id: resumeSession.id,
                title: resumeSession.title,
                current: resumeSession.currentIndex + 1,
                total: resumeSession.questionIds.length,
            } : null,
        });
    },

    switchSubject(event) {
        const subjectId = event.currentTarget.dataset.id;
        if (!subjectId || subjectId === this.data.subjectId) return;
        store.setSubjectId(subjectId);
        this.refresh();
        scrollPageTo(0, 200);
    },

    startMode(event) {
        const mode = event.currentTarget.dataset.mode;
        const subject = getSubject(this.data.subjectId);
        if (mode === 'chapter') {
            wx.navigateTo({ url: `/pages/chapters/chapters?subject=${subject.id}` });
            return;
        }

        const state = store.load();
        const pool = subject.questions.filter((question) => !state.slashed[question.id]);
        let selected = pool;
        let title = `${subject.short} 顺序练习`;
        if (mode === 'random') {
            selected = shuffle(pool);
            title = `${subject.short} 随机练习`;
        } else if (mode === 'single') {
            selected = pool.filter((question) => question.type === 'single');
            title = `${subject.short} 单选专练`;
        } else if (mode === 'multiple') {
            selected = pool.filter((question) => question.type === 'multiple');
            title = `${subject.short} 多选专练`;
        } else if (mode === 'wrong') {
            selected = pool.filter((question) => state.wrong[question.id]);
            title = `${subject.short} 错题重练`;
        } else if (mode === 'favorite') {
            selected = pool.filter((question) => state.favorites[question.id]);
            title = `${subject.short} 收藏练习`;
        }
        if (!selected.length) {
            let emptyText = '还没有收藏题目';
            if (mode === 'wrong') emptyText = '暂无错题，继续保持';
            if (mode === 'multiple') emptyText = '本科目没有多选题';
            if (mode === 'single') emptyText = '本科目没有单选题';
            wx.showToast({ title: emptyText, icon: 'none' });
            return;
        }
        const session = store.createSession({ mode, title, questions: selected });
        wx.navigateTo({ url: `/pages/practice/practice?session=${session.id}` });
    },

    continuePractice() {
        const session = this.data.resumeSession;
        if (!session) return;
        wx.navigateTo({ url: `/pages/practice/practice?session=${session.id}` });
    },

});
