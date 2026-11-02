const xixinQuestions = require('../data/questions.js');
const mayuanQuestions = require('../data/mayuan.js');
const maogaiQuestions = require('../data/maogai.js');
const annotations = require('../data/annotations.js');
const mayuanAnnotations = require('../data/annotations-mayuan.js');
const maogaiAnnotations = require('../data/annotations-maogai.js');

const annotationMap = Object.assign({}, mayuanAnnotations, maogaiAnnotations, annotations);

const DEFAULT_SUBJECT = 'mayuan';

const DEFINITIONS = [
    {
        id: 'mayuan',
        name: '马克思主义基本原理',
        short: '马原',
        title: '马原题库',
        eyebrow: '马原刷题助手',
        tag: '马',
        source: mayuanQuestions,
    },
    {
        id: 'maogai',
        name: '毛泽东思想和中国特色社会主义理论体系概论',
        short: '毛中特',
        title: '毛中特题库',
        eyebrow: '毛中特刷题助手',
        tag: '毛',
        source: maogaiQuestions,
    },
    {
        id: 'xixin',
        name: '习近平新时代中国特色社会主义思想',
        short: '新思想',
        title: '新思想题库',
        eyebrow: '新思想学习助手',
        tag: '习',
        source: xixinQuestions,
    },
];

function enrich(question, subject) {
    const annotation = annotationMap[question.id] || {};
    return Object.assign({}, question, {
        subject: subject.id,
        subjectName: subject.short,
        solution: annotation.solution || question.explanation || '',
        memoryTip: annotation.memoryTip || '',
        optionAnalysis: annotation.optionAnalysis || {},
    });
}

function buildChapters(list) {
    const chapterMap = {};
    const order = [];
    list.forEach((question) => {
        if (!chapterMap[question.chapter]) {
            chapterMap[question.chapter] = {
                name: question.chapter,
                total: 0,
                questions: [],
            };
            order.push(question.chapter);
        }
        chapterMap[question.chapter].total += 1;
        chapterMap[question.chapter].questions.push(question);
    });
    return order.map((name) => chapterMap[name]);
}

const subjects = DEFINITIONS.map((definition) => {
    const list = definition.source.map((question) => enrich(question, definition));
    return {
        id: definition.id,
        name: definition.name,
        short: definition.short,
        title: definition.title,
        eyebrow: definition.eyebrow,
        tag: definition.tag,
        questions: list,
        total: list.length,
        chapters: buildChapters(list),
        annotated: list.filter((question) => question.optionAnalysis && Object.keys(question.optionAnalysis).length).length,
    };
});

const subjectMap = subjects.reduce((map, subject) => {
    map[subject.id] = subject;
    return map;
}, {});

const questions = subjects.reduce((all, subject) => all.concat(subject.questions), []);

const questionMap = questions.reduce((map, question) => {
    map[question.id] = question;
    return map;
}, {});

function getSubject(subjectId) {
    return subjectMap[subjectId] || subjectMap[DEFAULT_SUBJECT];
}

function getSubjectQuestions(subjectId) {
    return getSubject(subjectId).questions;
}

function getSubjectOfQuestion(questionId) {
    const question = questionMap[questionId];
    return question ? question.subject : DEFAULT_SUBJECT;
}

function getByIds(ids) {
    return (ids || []).map((id) => questionMap[id]).filter(Boolean);
}

function normalizeAnswer(question, answer) {
    const selected = Array.isArray(answer) ? answer : [answer];
    const order = question.options.reduce((map, option, index) => {
        map[option.key] = index;
        return map;
    }, {});
    return selected
        .filter((key, index) => key && selected.indexOf(key) === index)
        .sort((a, b) => order[a] - order[b]);
}

function isCorrect(question, answer) {
    const actual = normalizeAnswer(question, answer || []);
    const expected = normalizeAnswer(question, question.answer);
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function formatAnswer(question) {
    return question.answer.map((key) => {
        if (question.type !== 'judge') return key;
        const option = question.options.find((item) => item.key === key);
        return option ? `${key}（${option.text}）` : key;
    }).join('、');
}

function shuffle(list) {
    const result = list.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const temporary = result[index];
        result[index] = result[randomIndex];
        result[randomIndex] = temporary;
    }
    return result;
}

function getChapters(subjectId) {
    return getSubject(subjectId).chapters;
}

module.exports = {
    questions,
    subjects,
    DEFAULT_SUBJECT,
    getSubject,
    getSubjectQuestions,
    getSubjectOfQuestion,
    getByIds,
    normalizeAnswer,
    isCorrect,
    formatAnswer,
    shuffle,
    getChapters,
};
