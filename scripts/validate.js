const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const rawQuestions = require(path.join(root, 'data/questions.js'));
const annotations = require(path.join(root, 'data/annotations.js'));
const questions = require(path.join(root, 'utils/question.js')).questions;
const questionUtils = require(path.join(root, 'utils/question.js'));

const subjectList = questionUtils.subjects;
const subjects = subjectList;
const xixin = subjectList.find((subject) => subject.id === 'xixin');
const mayuan = subjectList.find((subject) => subject.id === 'mayuan');
const maogai = subjectList.find((subject) => subject.id === 'maogai');
assert(xixin && mayuan && maogai, '学科定义缺失');
assert.strictEqual(subjectList.length, 3, '学科数量应为 3');
assert.strictEqual(xixin.total, 392, '习思想题量不正确');
assert.strictEqual(mayuan.total, 450, '马原题量不正确');
assert.strictEqual(maogai.total, 255, '毛概题量不正确');
assert.strictEqual(questions.length, 1097, '题库总数不正确');
assert.strictEqual(new Set(questions.map((question) => question.id)).size, 1097, '题目 ID 不唯一');
assert.strictEqual(xixin.chapters.length, 14, '习思想章节数不正确');
assert.strictEqual(mayuan.chapters.length, 8, '马原章节数不正确');
assert.strictEqual(maogai.chapters.length, 8, '毛概章节数不正确');
assert.deepStrictEqual(xixin.questions.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
}, {}), { single: 227, multiple: 157, judge: 8 }, '习思想题型数量不正确');
assert.deepStrictEqual(mayuan.questions.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
}, {}), { single: 450 }, '马原应只有单选题');
assert.deepStrictEqual(maogai.questions.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
}, {}), { single: 157, multiple: 98 }, '毛概题型数量不正确');
assert.deepStrictEqual(
    questions.map((question) => question.answer),
    subjects.flatMap((subject) => subject.questions).map((question) => question.answer),
    '标准答案顺序异常'
);
assert.deepStrictEqual(
    xixin.questions.map((question) => question.answer),
    rawQuestions.map((question) => question.answer),
    '原题标准答案被改动'
);
[xixin, mayuan, maogai].forEach((subject) => {
    subject.questions.forEach((question) => {
        assert(question.question, `${subject.short} 题目 ${question.id} 缺少题干`);
        assert(question.options.length >= 2, `${subject.short} 题目 ${question.id} 缺少选项`);
        assert(question.answer.length > 0, `${subject.short} 题目 ${question.id} 缺少答案`);
        const keys = question.options.map((option) => option.key);
        assert(question.answer.every((key) => keys.indexOf(key) !== -1), `${subject.short} 题目 ${question.id} 答案不在选项中`);
        if (question.type === 'single') assert.strictEqual(question.answer.length, 1, `${subject.short} 题目 ${question.id} 单选题答案不唯一`);
        question.options.forEach((option) => {
            assert(option.text, `${subject.short} 题目 ${question.id} 选项 ${option.key} 文本为空`);
        });
        assert(questionUtils.isCorrect(question, question.answer), `题目 ${question.id} 正确答案判题失败`);
        assert(!questionUtils.isCorrect(question, []), `题目 ${question.id} 空答案不应判对`);
    });
});

let optionAnalysisCount = 0;
const memoryTips = [];
xixin.questions.forEach((question) => {
    const rawQuestion = rawQuestions.find((item) => item.id === question.id);
    assert(question.question && question.explanation, `题目 ${question.id} 缺少题干或解析`);
    assert(question.options.length >= 2, `题目 ${question.id} 缺少选项`);
    assert(question.answer.length > 0, `题目 ${question.id} 缺少答案`);
    assert.deepStrictEqual(question.answer, rawQuestion.answer, `题目 ${question.id} 答案被注解层改动`);
    assert(question.solution && question.solution !== question.explanation, `题目 ${question.id} 缺少独立解题思路`);
    assert(question.memoryTip && question.memoryTip.length >= 12, `题目 ${question.id} 缺少记忆小注`);
    assert.deepStrictEqual(
        Object.keys(question.optionAnalysis),
        question.options.map((option) => option.key),
        `题目 ${question.id} 的选项解析不完整`
    );
    question.options.forEach((option) => {
        assert(question.optionAnalysis[option.key].length >= 16, `题目 ${question.id}${option.key} 解析过短`);
        optionAnalysisCount += 1;
    });
    memoryTips.push(question.memoryTip);
    assert(questionUtils.isCorrect(question, question.answer), `题目 ${question.id} 正确答案判题失败`);
    assert(!questionUtils.isCorrect(question, []), `题目 ${question.id} 空答案不应判对`);
});
assert.strictEqual(Object.keys(annotations).length, 392, '解析映射题数不正确');
assert.strictEqual(optionAnalysisCount, 1567, '选项解析总数不正确');
assert.strictEqual(new Set(memoryTips).size, 392, '记忆小注存在重复');

const mayuanAnnotations = require(path.join(root, 'data/annotations-mayuan.js'));
const maogaiAnnotations = require(path.join(root, 'data/annotations-maogai.js'));
assert.strictEqual(Object.keys(mayuanAnnotations).length, 450, '马原解析条目数不正确');
assert.strictEqual(Object.keys(maogaiAnnotations).length, 255, '毛概解析条目数不正确');
assert.strictEqual(mayuan.annotated, 450, '马原解析覆盖不全');
assert.strictEqual(maogai.annotated, 255, '毛概解析覆盖不全');
const bonusTips = [];
let bonusOptionCount = 0;
[mayuan, maogai].forEach((subject) => {
    subject.questions.forEach((question) => {
        const keys = question.options.map((option) => option.key);
        assert(question.solution && question.solution.length >= 40, `${subject.short} 题目 ${question.id} 缺少解题思路`);
        assert(question.memoryTip && question.memoryTip.length >= 18, `${subject.short} 题目 ${question.id} 缺少记忆小注`);
        assert.deepStrictEqual(Object.keys(question.optionAnalysis), keys, `${subject.short} 题目 ${question.id} 选项解析不完整`);
        question.options.forEach((option) => {
            assert(question.optionAnalysis[option.key].length >= 16, `${subject.short} 题目 ${question.id}${option.key} 解析过短`);
            bonusOptionCount += 1;
        });
        bonusTips.push(question.memoryTip);
    });
});
assert.strictEqual(bonusOptionCount, 2820, '马原毛概选项解析总数不正确');
assert.strictEqual(new Set(bonusTips).size, 705, '马原毛概记忆小注存在重复');

assert(app.tabBar && Array.isArray(app.tabBar.list), '缺少底部栏目配置');
assert.strictEqual(app.tabBar.list.length, 3, '底部栏目应为三栏');
assert.deepStrictEqual(app.tabBar.list.map((item) => item.text), ['刷题', '题库', '我的'], '底部栏目名称不正确');
app.tabBar.list.forEach((item) => {
    assert(app.pages.indexOf(item.pagePath) !== -1, `栏目页面未注册: ${item.pagePath}`);
});

app.pages.forEach((page) => {
    ['js', 'wxml', 'wxss', 'json'].forEach((extension) => {
        const file = path.join(root, `${page}.${extension}`);
        assert(fs.existsSync(file), `缺少页面文件: ${page}.${extension}`);
        if (extension === 'json') JSON.parse(fs.readFileSync(file, 'utf8'));
    });
});

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
}

const sourceFiles = [
    path.join(root, 'app.js'),
    ...walk(path.join(root, 'pages')),
    ...walk(path.join(root, 'utils')),
];
sourceFiles.filter((file) => file.endsWith('.js')).forEach((file) => {
    const code = fs.readFileSync(file, 'utf8');
    new vm.Script(code, { filename: file });
    const requirePattern = /require\(['"](\.[^'"]+)['"]\)/g;
    let match;
    while ((match = requirePattern.exec(code))) {
        const target = path.resolve(path.dirname(file), match[1]);
        assert(fs.existsSync(target), `本地引用不存在: ${file} -> ${match[1]}`);
    }
    if (path.basename(file) !== 'export.js') {
        assert(!/\b(document|window|localStorage)\b/.test(code), `包含浏览器 API: ${file}`);
    }
});

const storage = {};
const writtenFiles = {};
let navigateBackCount = 0;
let lastNavigateUrl = '';
let lastSharedFile = null;
let lastModal = null;
let mockReadFileData = '';
global.wx = {
    env: { USER_DATA_PATH: '/mock-user-data' },
    getStorageSync(key) { return storage[key]; },
    setStorageSync(key, value) { storage[key] = JSON.parse(JSON.stringify(value)); },
    removeStorageSync(key) { delete storage[key]; },
    showToast() {},
    showLoading() {},
    hideLoading() {},
    pageScrollTo() {},
    setNavigationBarTitle() {},
    navigateBack() { navigateBackCount += 1; },
    navigateTo(options) { lastNavigateUrl = options.url; },
    showModal(options) { lastModal = options; },
    setClipboardData() {},
    shareFileMessage(options) {
        lastSharedFile = options;
        if (options.success) options.success({});
    },
    chooseMessageFile() {},
    getFileSystemManager() {
        return {
            writeFileSync(filePath, data) { writtenFiles[filePath] = data; },
            readFile(options) { options.success({ data: mockReadFileData }); },
        };
    },
};
const pageConfigs = {};
app.pages.forEach((page) => {
    let config;
    global.Page = (pageConfig) => { config = pageConfig; };
    require(path.join(root, `${page}.js`));
    pageConfigs[page] = config;
});

function createPageInstance(pagePath) {
    const config = pageConfigs[pagePath];
    assert(config, `页面未注册: ${pagePath}`);
    const instance = Object.assign({}, config);
    instance.data = JSON.parse(JSON.stringify(config.data || {}));
    instance.setData = function setData(update, callback) {
        Object.assign(this.data, update);
        if (callback) callback();
    };
    return instance;
}

const store = require(path.join(root, 'utils/store.js'));
const single = questions.find((question) => question.type === 'single');
const multiple = questions.find((question) => question.type === 'multiple');
const wrongAnswer = single.options.find((option) => !single.answer.includes(option.key)).key;
const practice = store.createSession({ mode: 'sequence', title: '测试练习', questions: [single, multiple] });
store.answerQuestion(practice.id, single, [wrongAnswer], false);
assert(store.load().wrong[single.id], '答错后未进入错题本');
assert.strictEqual(store.load().records[single.id].attempts, 1, '答题次数记录不正确');
store.answerQuestion(practice.id, single, [wrongAnswer], false);
assert.strictEqual(store.load().records[single.id].attempts, 1, '重复提交导致答题次数重复');
const retry = store.createSession({ mode: 'wrong', title: '错题重练', questions: [single] });
store.answerQuestion(retry.id, single, single.answer, true);
assert(!store.load().wrong[single.id], '重练答对后未移出错题本');
store.setSessionIndex(retry.id, 1);
assert.strictEqual(store.getLatestSession().currentIndex, 1, '断点位置未保存');
assert.strictEqual(store.toggleFavorite(single.id), true, '收藏失败');
assert.strictEqual(store.toggleFavorite(single.id), false, '取消收藏失败');

// 斩题：加入后从顺序组卷中排除，取消后恢复
const slashTarget = xixin.questions[0];
assert.strictEqual(store.toggleSlash(slashTarget.id), true, '斩题失败');
assert(store.load().slashed[slashTarget.id], '斩题状态未写入');
const catalogForSlash = require(path.join(root, 'utils/catalog.js'));
const slashedCatalog = catalogForSlash.buildCatalog({ subject: 'xixin', state: store.load(), filter: 'slashed', keyword: '', expanded: {} });
assert.strictEqual(slashedCatalog.filteredCount, 1, '已斩筛选数量不正确');
assert.strictEqual(slashedCatalog.chapters.flatMap((chapter) => chapter.questions)[0].statusText, '已斩', '已斩状态未在目录展示');
assert.strictEqual(store.toggleSlash(slashTarget.id), false, '取消斩题失败');
assert(!store.load().slashed[slashTarget.id], '斩题状态未清除');

// 练习偏好
const prefs = require(path.join(root, 'utils/prefs.js'));
assert.deepStrictEqual(prefs.get(), { autoNext: true, hideNav: false, recite: false }, '练习偏好默认值不正确');
prefs.set({ hideNav: true });
assert.strictEqual(prefs.get().hideNav, true, '隐藏底栏偏好未保存');
prefs.set({ hideNav: false });
assert.strictEqual(prefs.get().hideNav, false, '隐藏底栏偏好未恢复');

const catalogUtils = require(path.join(root, 'utils/catalog.js'));
const catalogQuestionA = xixin.questions[4];
const catalogQuestionB = xixin.questions[6];
const catalogOutsideQuestion = xixin.questions[9];
const catalogCrossChapterWrong = xixin.questions[20];
const directorySession = store.createSession({
    mode: 'chapter',
    title: '目录测试练习',
    questions: [catalogQuestionA, catalogQuestionB],
});
store.setSessionIndex(directorySession.id, 1);
const wrongFactory = store.createSession({
    mode: 'sequence',
    title: '生成错题状态',
    questions: [catalogQuestionA, catalogCrossChapterWrong],
});
const wrongOption = catalogQuestionA.options.find((option) => !catalogQuestionA.answer.includes(option.key)).key;
const crossWrongOption = catalogCrossChapterWrong.options.find((option) => !catalogCrossChapterWrong.answer.includes(option.key)).key;
store.answerQuestion(wrongFactory.id, catalogQuestionA, [wrongOption], false);
store.answerQuestion(wrongFactory.id, catalogCrossChapterWrong, [crossWrongOption], false);
store.toggleFavorite(catalogQuestionA.id);
store.toggleFavorite(catalogQuestionB.id);

const allCatalog = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'all',
    keyword: '',
    expanded: {},
    activeSession: store.getSession(directorySession.id),
});
assert.strictEqual(allCatalog.total, 392, '目录未展示全部题目');
assert.strictEqual(allCatalog.filteredCount, 392, '全部筛选数量不正确');
assert.strictEqual(allCatalog.chapters.length, 14, '目录章节数量不正确');
assert(allCatalog.chapters.every((chapter) => !chapter.isExpanded), '目录章节默认未收起');
assert.deepStrictEqual(allCatalog.filters.map((item) => item.label), ['全部', '未做', '错题', '收藏', '已斩'], '筛选项不完整');
assert.strictEqual(allCatalog.filterCounts.wrong, 2, '错题筛选数量不正确');
assert(allCatalog.filterCounts.favorite >= 2, '收藏筛选数量不正确');
const allCatalogItems = allCatalog.chapters.flatMap((chapter) => chapter.questions);
assert(allCatalogItems.every((item) => Array.from(item.summary).length <= 46), '题干摘要超过 45 字');
assert.strictEqual(new Set(allCatalogItems.map((item) => item.id)).size, 392, '目录题目重复');
const itemA = allCatalogItems.find((item) => item.id === catalogQuestionA.id);
const itemB = allCatalogItems.find((item) => item.id === catalogQuestionB.id);
assert.strictEqual(itemA.statusText, '错题', '错题状态显示不正确');
assert.strictEqual(itemA.isFavorite, true, '错题收藏标识丢失');
assert.strictEqual(itemB.isCurrent, true, '当前题标识不正确');

const favoriteCatalog = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'favorite',
    keyword: '',
    expanded: {},
    activeSession: store.getSession(directorySession.id),
});
const favoriteA = favoriteCatalog.chapters.flatMap((chapter) => chapter.questions)
    .find((item) => item.id === catalogQuestionA.id);
assert(favoriteA, '收藏筛选遗漏题目');
assert.strictEqual(favoriteA.statusText, '错题', '收藏筛选覆盖了错题状态');
const wrongCatalog = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'wrong',
    keyword: '',
    expanded: {},
});
assert.strictEqual(wrongCatalog.filteredCount, 2, '错题筛选跨章节结果不正确');
assert.strictEqual(wrongCatalog.chapters.length, 2, '错题筛选未跨章节显示');
assert.strictEqual(wrongCatalog.chapters.reduce((sum, chapter) => sum + chapter.wrong, 0), 2, '章节错题数量不正确');
const undoneCatalog = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'undone',
    keyword: '',
    expanded: {},
});
assert(!undoneCatalog.chapters.flatMap((chapter) => chapter.questions).some((item) => item.id === catalogQuestionA.id), '未做筛选包含了已做题目');

const idSearch = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'all',
    keyword: String(catalogQuestionA.id),
    expanded: {},
});
assert.strictEqual(idSearch.filteredCount, 1, '题号搜索不准确');
assert.strictEqual(idSearch.visibleQuestions[0].id, catalogQuestionA.id, '题号搜索结果不正确');
const chapterSearch = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'all',
    keyword: catalogQuestionA.chapter,
    expanded: {},
});
const chapterExpected = xixin.questions.filter((question) => question.chapter === catalogQuestionA.chapter).length;
assert.strictEqual(chapterSearch.filteredCount, chapterExpected, '章节名称搜索不完整');
const stemKeyword = Array.from(catalogQuestionA.question.replace(/\s+/g, '')).slice(0, 8).join('');
const stemSearch = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'all',
    keyword: stemKeyword,
    expanded: {},
});
assert(stemSearch.filteredCount >= 1, '题干关键词搜索失败');
const expandedCatalog = catalogUtils.buildCatalog({
    subject: 'xixin',
    state: store.load(),
    filter: 'all',
    keyword: '',
    expanded: { [catalogQuestionA.chapter]: true },
});
assert(expandedCatalog.chapters.find((chapter) => chapter.name === catalogQuestionA.chapter).isExpanded, '章节展开状态未生效');

const catalogPage = createPageInstance('pages/catalog/catalog');
catalogPage.onLoad({ session: directorySession.id, subject: 'xixin' });
assert.strictEqual(catalogPage.data.activeSessionTitle, '目录测试练习', '目录未识别当前练习');
catalogPage.selectFilter({ currentTarget: { dataset: { filter: 'wrong' } } });
assert.strictEqual(catalogPage.data.filter, 'wrong', '目录筛选状态未切换');
catalogPage.handleSearchInput({ detail: { value: String(catalogQuestionA.id) } });
assert.strictEqual(catalogPage.data.keyword, String(catalogQuestionA.id), '目录搜索状态未保存');
catalogPage.toggleChapter({ currentTarget: { dataset: { name: catalogQuestionA.chapter } } });
catalogPage.onPageScroll({ scrollTop: 320 });
catalogPage.onHide();
const savedCatalogUi = storage.sizheng_catalog_ui_v1;
assert.strictEqual(savedCatalogUi.filter, 'wrong', '筛选条件未保存');
assert.strictEqual(savedCatalogUi.scrollTop, 320, '目录滚动位置未保存');
assert.strictEqual(savedCatalogUi.expanded[catalogQuestionA.chapter], true, '章节展开状态未保存');

const catalogReloaded = createPageInstance('pages/catalog/catalog');
catalogReloaded.onLoad({ session: directorySession.id, subject: 'xixin' });
assert.strictEqual(catalogReloaded.data.filter, 'wrong', '返回目录后筛选条件丢失');
assert.strictEqual(catalogReloaded.data.keyword, String(catalogQuestionA.id), '返回目录后搜索词丢失');
assert(catalogReloaded.data.chapters.find((chapter) => chapter.name === catalogQuestionA.chapter).isExpanded, '返回目录后章节展开状态丢失');
catalogReloaded.selectQuestion({ currentTarget: { dataset: { id: catalogQuestionA.id } } });
assert(lastNavigateUrl.indexOf('/pages/practice/practice?session=') === 0, '同组跳题未打开答题页');
assert.strictEqual(storage.sizheng_catalog_jump_v1.questionId, catalogQuestionA.id, '同组跳题未保存目标题目');

const practicePage = createPageInstance('pages/practice/practice');
practicePage.session = store.getSession(directorySession.id);
practicePage.questions = questionUtils.getByIds(practicePage.session.questionIds);
practicePage.consumeCatalogJump();
const jumpedSession = store.getSession(directorySession.id);
assert.strictEqual(jumpedSession.currentIndex, 0, '同组跳题未更新原练习进度');
assert.strictEqual(jumpedSession.mode, 'chapter', '同组跳题改变了原练习模式');
assert.deepStrictEqual(jumpedSession.questionIds, [catalogQuestionA.id, catalogQuestionB.id], '同组跳题改变了原练习队列');
assert(!storage.sizheng_catalog_jump_v1, '同组跳题状态未清理');

catalogReloaded.uiState = { filter: 'all', keyword: '', expanded: {}, scrollTop: 0 };
catalogReloaded.setData({ filter: 'all', keyword: '' });
catalogReloaded.buildView();
const beforeCrossSessionIndex = store.getSession(directorySession.id).currentIndex;
catalogReloaded.startCatalogPractice(catalogOutsideQuestion.id);
assert(lastNavigateUrl.indexOf('/pages/practice/practice?session=') === 0, '目录跨组题目未进入答题页');
const newestSession = store.getLatestSession();
assert.strictEqual(newestSession.mode, 'catalog', '目录跨组练习模式不正确');
assert.strictEqual(newestSession.questionIds.length, 392, '目录练习未复用现有题库');
assert.strictEqual(questionUtils.getByIds(newestSession.questionIds)[newestSession.currentIndex].id, catalogOutsideQuestion.id, '目录未定位到目标题号');
assert.strictEqual(store.getSession(directorySession.id).currentIndex, beforeCrossSessionIndex, '跨组跳题破坏了原练习进度');

delete storage.sizheng_catalog_ui_v1;
const exportPage = createPageInstance('pages/catalog/catalog');
exportPage.onLoad({ subject: 'xixin' });
exportPage.toggleSelectionMode();
assert.strictEqual(exportPage.data.selectionMode, true, '目录未进入选择导出模式');
exportPage.handleQuestionTap({ currentTarget: { dataset: { id: catalogQuestionA.id } } });
exportPage.handleQuestionTap({ currentTarget: { dataset: { id: catalogCrossChapterWrong.id } } });
assert.strictEqual(exportPage.data.selectedCount, 2, '跨章节选择题目数量不正确');
assert.deepStrictEqual(
    exportPage.getSelectedQuestions().map((question) => question.id),
    [catalogQuestionA.id, catalogCrossChapterWrong.id],
    '跨章节选择结果不正确'
);
const exportUtils = require(path.join(root, 'utils/export.js'));
const selectedExport = exportUtils.buildDocx(exportPage.getSelectedQuestions(), {
    title: '思政练习生自选题目',
    filePrefix: '思政练习生自选题目',
    date: new Date(2026, 9, 31, 12, 40),
});
const exportBytes = Buffer.from(selectedExport.buffer);
assert.strictEqual(exportBytes.slice(0, 4).toString('hex'), '504b0304', 'Word 文件不是有效 ZIP');
assert.strictEqual(exportBytes.readUInt32LE(exportBytes.length - 22), 0x06054B50, 'Word 文件缺少 ZIP 目录');
assert.strictEqual(exportBytes.readUInt16LE(exportBytes.length - 12), 5, 'Word 文档部件数量不正确');
assert(selectedExport.fileName.endsWith('.docx'), 'Word 文件名不正确');
assert(selectedExport.documentXml.indexOf(catalogQuestionA.question) !== -1, 'Word 文档缺少题干');
assert(selectedExport.documentXml.indexOf(catalogQuestionA.solution) !== -1, 'Word 文档缺少解题思路');
assert(selectedExport.documentXml.indexOf(catalogQuestionA.memoryTip) !== -1, 'Word 文档缺少记忆小注');
assert(selectedExport.documentXml.indexOf(catalogQuestionA.optionAnalysis.A) !== -1, 'Word 文档缺少选项解析');
assert(selectedExport.documentXml.indexOf('正确答案：') !== -1, 'Word 文档缺少正确答案');
exportPage.toggleSelectAllVisible();
assert.strictEqual(exportPage.data.selectedCount, 392, '全选当前结果数量不正确');
assert.strictEqual(exportPage.data.allVisibleSelected, true, '全选状态不正确');
exportPage.toggleSelectAllVisible();
assert.strictEqual(exportPage.data.selectedCount, 0, '取消全选未清空选择');
exportPage.handleQuestionTap({ currentTarget: { dataset: { id: catalogQuestionA.id } } });
exportPage.selectFilter({ currentTarget: { dataset: { filter: 'wrong' } } });
assert.strictEqual(exportPage.data.selectionMode, false, '切换筛选未退出选择模式');
assert.strictEqual(exportPage.data.selectedCount, 0, '切换筛选未清空选择');

const indexWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8');
const practiceWxml = fs.readFileSync(path.join(root, 'pages/practice/practice.wxml'), 'utf8');
const catalogWxml = fs.readFileSync(path.join(root, 'pages/catalog/catalog.wxml'), 'utf8');
assert(indexWxml.indexOf('data-mode="catalog"') === -1, '首页仍保留已迁出的题库目录入口');
assert(indexWxml.indexOf('data-mode="wrong"') !== -1, '首页缺少错题重练入口');
assert(indexWxml.indexOf('data-mode="single"') !== -1, '首页缺少单选专练入口');
assert(indexWxml.indexOf('data-mode="multiple"') !== -1, '首页缺少多选专练入口');
assert(indexWxml.indexOf('data-mode="search"') === -1, '首页仍保留旧题目搜索入口');
assert(practiceWxml.indexOf('bindtap="openCatalog"') !== -1, '答题页缺少题目目录入口');
assert(catalogWxml.indexOf('bindtap="exportWrongQuestions"') !== -1, '目录缺少错题导出入口');
assert(catalogWxml.indexOf('bindtap="exportSelectedQuestions"') !== -1, '目录缺少自选题目导出入口');

delete storage.sizheng_catalog_ui_v1;
const homeCatalogPage = createPageInstance('pages/catalog/catalog');
homeCatalogPage.onLoad({});
assert.strictEqual(homeCatalogPage.data.activeSessionTitle, '', '首页目录错误绑定了练习上下文');
homeCatalogPage.selectQuestion({ currentTarget: { dataset: { id: questions[30].id } } });
const homeCatalogSession = store.getLatestSession();
assert.strictEqual(homeCatalogSession.mode, 'catalog', '首页目录选题未创建练习');
assert.strictEqual(questionUtils.getByIds(homeCatalogSession.questionIds)[homeCatalogSession.currentIndex].id, questions[30].id, '首页目录未定位目标题目');

assert(!store.startExam && !store.finishExam && !store.createExamReview, '模拟考试接口未清理');
assert(!app.pages.some((page) => page.indexOf('exam') !== -1), '仍有模拟考试页面路由');
assert(!store.load().exam && !store.load().examResult, '学习状态仍保留考试字段');

const backupUtils = require(path.join(root, 'utils/backup.js'));
const backupState = store.load();
const generatedBackup = backupUtils.buildBackup(backupState, new Date('2026-10-31T05:20:00.000Z'));
assert.strictEqual(JSON.parse(generatedBackup.text).format, 'new-thought-quiz-learning-backup', '备份格式标识不正确');
assert.strictEqual(JSON.parse(generatedBackup.text).app, '思政练习生', '备份应用名称不正确');
assert(generatedBackup.summary.practiced > 0, '备份遗漏已练记录');
assert(generatedBackup.summary.wrong > 0, '备份遗漏错题');
assert(generatedBackup.summary.sessions > 0, '备份遗漏练习断点');
const validatedBackup = backupUtils.validateBackupText(generatedBackup.text);
assert.strictEqual(validatedBackup.ok, true, '正常备份无法通过校验');
assert.strictEqual(validatedBackup.summary.practiced, generatedBackup.summary.practiced, '备份恢复摘要不一致');
assert.strictEqual(backupUtils.validateBackupText('not json').ok, false, '损坏 JSON 未被拒绝');
assert.strictEqual(backupUtils.validateBackupText(JSON.stringify({ format: 'other', version: 1, state: {} })).ok, false, '错误格式未被拒绝');
assert.strictEqual(backupUtils.validateBackupText(JSON.stringify({ format: 'new-thought-quiz-learning-backup', version: 99, state: {} })).ok, false, '不支持版本未被拒绝');
assert.strictEqual(backupUtils.validateBackupText(`${generatedBackup.text}${' '.repeat(2 * 1024 * 1024)}`).ok, false, '超大备份未被拒绝');
const attackPayload = JSON.parse(generatedBackup.text);
attackPayload.state.records['999999'] = { attempts: 1, correct: 1 };
attackPayload.state.sessions = JSON.parse(`{"__proto__":{"id":"__proto__","questionIds":[${single.id}],"answers":{},"results":{},"submitted":{}}}`);
attackPayload.state.latestSessionId = '__proto__';
const cleanedAttack = backupUtils.validateBackupText(JSON.stringify(attackPayload));
assert.strictEqual(cleanedAttack.ok, true, '含未知题号的备份应被安全清洗');
assert(!cleanedAttack.state.records[999999], '未知题号记录未被过滤');
assert(!Object.prototype.hasOwnProperty.call(cleanedAttack.state.sessions, '__proto__'), '危险 session 键未被过滤');
assert.notStrictEqual(cleanedAttack.state.latestSessionId, '__proto__', '危险 latestSessionId 未被过滤');

const dataPage = createPageInstance('pages/data/data');
dataPage.onShow();
assert.strictEqual(dataPage.data.summary.practiced, generatedBackup.summary.practiced, '数据页学习摘要不正确');
dataPage.exportBackup();
assert(lastSharedFile && lastSharedFile.fileName.indexOf('思政练习生学习档案_') === 0, '学习档案未调用微信文件转发');
assert(lastSharedFile.fileName.endsWith('.json'), '学习档案扩展名不正确');
assert(Object.keys(writtenFiles).some((filePath) => filePath.indexOf('.json') !== -1), '学习档案未写入本地文件');
assert(storage.sizheng_quiz_backup_meta_v1.lastExportAt, '导出时间未记录');
const exportedFileContent = writtenFiles[lastSharedFile.filePath];
assert.strictEqual(backupUtils.validateBackupText(exportedFileContent).ok, true, '导出的学习档案不可恢复');

const extraFavorite = questions.find((question) => !store.load().favorites[question.id]);
const importedState = JSON.parse(JSON.stringify(validatedBackup.state));
importedState.favorites[extraFavorite.id] = Date.now();
const importedPayload = Object.assign({}, generatedBackup.payload, {
    state: importedState,
    exportedAt: '2026-10-31T05:25:00.000Z',
});
const importedText = JSON.stringify(importedPayload);
const importedValidation = backupUtils.validateBackupText(importedText);
assert.strictEqual(importedValidation.ok, true, '修改后的备份校验失败');
mockReadFileData = importedText;
lastModal = null;
dataPage.readRestoreFile({ path: '/mock/学习档案.json', size: importedText.length });
assert(lastModal && lastModal.title === '恢复学习档案？', '恢复前未弹出覆盖确认');
lastModal.success({ confirm: true });
assert(store.load().favorites[extraFavorite.id], '恢复后收藏未生效');
assert(storage.sizheng_quiz_rollback_v1 && storage.sizheng_quiz_rollback_v1.text, '恢复前未保存回滚快照');
assert.strictEqual(dataPage.data.hasRollback, true, '数据页未显示可撤销状态');

lastModal = null;
dataPage.undoRestore();
assert(lastModal && lastModal.title === '撤销上次恢复？', '撤销恢复未二次确认');
lastModal.success({ confirm: true });
assert(!store.load().favorites[extraFavorite.id], '撤销恢复未回到原学习记录');

// 三学科独立上下文
storage.sizheng_subject_v1 = 'mayuan';
const mayuanIndex = createPageInstance('pages/index/index');
mayuanIndex.onShow();
assert.strictEqual(mayuanIndex.data.subjectId, 'mayuan', '首页未读取上次选择的学科');
assert.strictEqual(mayuanIndex.data.total, 450, '马原首页题量不正确');
assert.strictEqual(mayuanIndex.data.chapterCount, 8, '马原章节数未同步到首页');
mayuanIndex.switchSubject({ currentTarget: { dataset: { id: 'maogai' } } });
assert.strictEqual(mayuanIndex.data.total, 255, '切换学科后题量未更新');
assert.strictEqual(storage.sizheng_subject_v1, 'maogai', '学科选择未持久化');
const maogaiCatalog = catalogUtils.buildCatalog({ subject: 'maogai', state: store.load(), filter: 'all', keyword: '', expanded: {} });
assert.strictEqual(maogaiCatalog.total, 255, '毛概目录题量不正确');
assert.strictEqual(maogaiCatalog.chapters.length, 8, '毛概目录章节数不正确');
const mayuanCatalog = catalogUtils.buildCatalog({ subject: 'mayuan', state: store.load(), filter: 'all', keyword: '', expanded: {} });
assert.strictEqual(mayuanCatalog.total, 450, '马原目录题量不正确');
assert(mayuanCatalog.chapters.every((chapter) => chapter.questions.every((item) => item.id >= 20001 && item.id <= 20450)), '马原目录混入其他学科题目');
assert(maogaiCatalog.chapters.flatMap((chapter) => chapter.questions).some((item) => item.typeText === '多选题'), '毛概目录缺少多选题');
storage.sizheng_subject_v1 = 'xixin';
assert(!storage.sizheng_quiz_rollback_v1, '撤销后回滚快照未清理');

lastModal = null;
dataPage.clearLearningData();
assert(lastModal && lastModal.title === '清除全部学习记录？', '清除记录未二次确认');
lastModal.success({ confirm: true });
assert.strictEqual(store.load().records && Object.keys(store.load().records).length, 0, '清除后仍有答题记录');
assert(!storage.sizheng_quiz_backup_meta_v1, '清除后仍保留备份元数据');

const dataWxml = fs.readFileSync(path.join(root, 'pages/data/data.wxml'), 'utf8');
assert(dataWxml.indexOf('bindtap="exportBackup"') !== -1, '数据页缺少导出入口');
assert(dataWxml.indexOf('bindtap="chooseRestoreFile"') !== -1, '数据页缺少恢复入口');
assert(indexWxml.indexOf('bindtap="openDataManagement"') === -1, '数据入口应已迁到我的栏目');
assert(dataWxml.indexOf('bindtap="chooseTheme"') !== -1, '我的页面缺少外观切换');
assert(dataWxml.indexOf('bindtap="chooseSize"') !== -1, '我的页面缺少字号切换');
assert(dataWxml.indexOf('bindtap="chooseFont"') !== -1, '我的页面缺少字体切换');
const practiceWxmlText = fs.readFileSync(path.join(root, 'pages/practice/practice.wxml'), 'utf8');
assert(practiceWxmlText.indexOf('nav-secondary') !== -1, '底部按钮未使用统一描边样式');
assert(practiceWxmlText.indexOf('previous-button') === -1, '仍残留旧的上一题样式类');
assert(practiceWxmlText.indexOf('nav-primary') === -1, '底部按钮仍存在实心变体');
const catalogWxmlText = fs.readFileSync(path.join(root, 'pages/catalog/catalog.wxml'), 'utf8');
assert(catalogWxmlText.indexOf('restoreQuestion') !== -1, '已斩题目缺少恢复入口');
assert(fs.readFileSync(path.join(root, 'pages/catalog/catalog.js'), 'utf8').indexOf("'slashed']") !== -1, '已斩筛选未纳入可选项');

const appWxss = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
assert(appWxss.indexOf('--bg: #ffffff;') !== -1, '纯白主题底色应为 #ffffff');
assert(appWxss.indexOf('--bg: #f1e6cd;') !== -1, '米黄主题底色应为 #f1e6cd');
assert(appWxss.indexOf('--bg: #e8dbbc;') !== -1, '牛皮纸主题底色应为 #e8dbbc');
assert(appWxss.indexOf('--bg: #e9f1e5;') !== -1, '护眼绿主题底色应为 #e9f1e5');
const appearanceUtil = require(path.join(root, 'utils/appearance.js'));
assert.strictEqual(appearanceUtil.THEMES.length, 5, '外观主题应为 5 档');

assert(appWxss.indexOf('--bg: #faf8f3;') === -1, '仍残留旧的米白底色');

const packageBytes = walk(root)
    .filter((file) => !file.includes(`${path.sep}scripts${path.sep}`)
        && !file.includes(`${path.sep}.workbuddy${path.sep}`)
        && !file.includes(`${path.sep}.git${path.sep}`)
        && !file.includes(`${path.sep}docs${path.sep}`)
        && !file.includes(`${path.sep}design${path.sep}`)
        && !file.endsWith('.genie')
        && !file.endsWith('.gitignore')
        && !file.endsWith('README.md'))
    .reduce((sum, file) => sum + fs.statSync(file).size, 0);
assert(packageBytes < 2 * 1024 * 1024, '主包超过 2MB');

console.log(JSON.stringify({
    result: 'PASS',
    questions: questions.length,
    subjects: subjectList.map((subject) => `${subject.short}:${subject.total}`),
    chapters: subjectList.reduce((sum, subject) => sum + subject.chapters.length, 0),
    pages: app.pages.length,
    syntaxFiles: sourceFiles.filter((file) => file.endsWith('.js')).length,
    optionAnalysis: optionAnalysisCount,
    memoryTips: new Set(memoryTips).size,
    packageBytes,
    tests: ['原答案未改动', '392题解析覆盖', '1567条选项解析', '特有记忆小注', '马原毛概逐项解析', '目录全题覆盖', '题号题干章节搜索', '未做错题收藏筛选', '章节折叠', '筛选与滚动恢复', '同组跳题', '跨组进度保留', '三学科切换与题量隔离', '错题Word导出', '跨章节自选导出', 'DOCX结构', '学习档案导出', '备份文件安全校验', '档案恢复', '恢复回滚', '清除本机记录', '判题', '错题记录与移除', '收藏', '断点续答', '底部三栏与页面引用', '主包大小'],
}, null, 2));
