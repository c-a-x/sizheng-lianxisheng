const { getChapters, getSubject, DEFAULT_SUBJECT } = require('../../utils/question.js');
const store = require('../../utils/store.js');
const appearance = require('../../utils/appearance.js');
const { setTitle } = require('../../utils/ui.js');

Page({
    data: {
        chapters: [],
        totalPracticed: 0,
        subjectShort: '',
        subjectName: '',
        appearanceClass: 'theme-paper size-m',
        rootStyle: '',
    },

    onLoad(options) {
        this.subjectId = options.subject || store.getSubjectId() || DEFAULT_SUBJECT;
    },

    onShow() {
        this.setData({
            appearanceClass: appearance.classes(),
            rootStyle: appearance.rootStyle(),
        });
        appearance.applyChrome();
        const subject = getSubject(this.subjectId);
        const state = store.load();
        let totalPracticed = 0;
        const chapters = getChapters(subject.id).map((chapter, index) => {
            const practiced = chapter.questions.filter((question) => state.records[question.id]).length;
            totalPracticed += practiced;
            const nameParts = chapter.name.match(/^(第\S+章)\s*(.+)$/);
            let label = '导论';
            let shortName = chapter.name;
            if (nameParts) {
                label = nameParts[1];
                shortName = nameParts[2];
            } else if (chapter.name.indexOf('导论') === 0) {
                label = '导论';
                shortName = chapter.name.replace(/^导论\s*/, '') || '导论';
            }
            return {
                name: chapter.name,
                label,
                shortName,
                total: chapter.total,
                practiced,
                progress: Math.round((practiced / chapter.total) * 100),
                questions: chapter.questions,
                index,
            };
        });
        this.chapters = chapters;
        this.setData({
            subjectShort: subject.short,
            subjectName: subject.name,
            chapters: chapters.map((chapter) => ({
                name: chapter.name,
                label: chapter.label,
                shortName: chapter.shortName,
                total: chapter.total,
                practiced: chapter.practiced,
                progress: chapter.progress,
                index: chapter.index,
            })),
            totalPracticed,
        });
        setTitle(`${subject.short} · 章节练习`);
    },

    startChapter(event) {
        const chapter = this.chapters[Number(event.currentTarget.dataset.index)];
        if (!chapter) return;
        const subject = getSubject(this.subjectId);
        const state = store.load();
        const pool = chapter.questions.filter((question) => !state.slashed[question.id]);
        if (!pool.length) {
            wx.showToast({ title: '本章题目已全部斩完', icon: 'none' });
            return;
        }
        const session = store.createSession({
            mode: 'chapter',
            title: chapter.name,
            questions: pool,
        });
        wx.navigateTo({ url: `/pages/practice/practice?session=${session.id}&subject=${subject.id}` });
    },
});
