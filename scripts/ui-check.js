// 页面级烟雾测试：三套主题 + 三档字号 + 五个页面
const path = require('path');
const root = path.resolve(__dirname, '..');

const storage = {};
const calls = { nav: [], tab: [], navUrl: '' };
const userFiles = [];

global.wx = {
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => { storage[k] = JSON.parse(JSON.stringify(v)); },
    removeStorageSync: (k) => { delete storage[k]; },
    showToast() {},
    pageScrollTo() {},
    navigateBack() {},
    navigateTo(o) { calls.navUrl = o.url; },
    switchTab() {},
    setNavigationBarTitle() {},
    setNavigationBarColor(o) { calls.nav.push(o); },
    setTabBarStyle(o) { calls.tab.push(o); },
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => ({
        readdirSync: () => userFiles.slice(),
        unlinkSync: (filePath) => {
            const name = String(filePath).split('/').pop();
            const index = userFiles.indexOf(name);
            if (index === -1) throw new Error('file not found');
            userFiles.splice(index, 1);
        },
        writeFileSync: (filePath) => {
            const name = String(filePath).split('/').pop();
            if (userFiles.indexOf(name) === -1) userFiles.push(name);
        },
        writeFile: (options) => {
            const name = String(options.filePath).split('/').pop();
            if (userFiles.indexOf(name) === -1) userFiles.push(name);
            if (options.success) options.success();
        },
    }),
};

let config = null;
global.Page = (c) => { config = c; };

function loadPage(rel) {
    config = null;
    delete require.cache[require.resolve(path.join(root, rel))];
    require(path.join(root, rel));
    const page = Object.assign({}, config);
    page.data = JSON.parse(JSON.stringify(config.data || {}));
    page.setData = function (patch, cb) {
        Object.keys(patch).forEach((k) => { this.data[k] = patch[k]; });
        if (cb) cb();
    };
    return page;
}

const store = require(path.join(root, 'utils/store.js'));
const question = require(path.join(root, 'utils/question.js'));
const appearance = require(path.join(root, 'utils/appearance.js'));

// 建一个练习会话供答题页使用
const session = store.createSession({
    mode: 'sequence',
    title: '马原 顺序练习',
    questions: question.getSubject('mayuan').questions.slice(0, 3),
});

const results = [];
function check(name, fn) {
    try {
        const detail = fn();
        results.push(['PASS', name, detail || '']);
    } catch (error) {
        results.push(['FAIL', name, error.message]);
    }
}

// 1) 首页
const index = loadPage('pages/index/index.js');
index.onShow();
check('首页 主题/字号', () => `${index.data.appearanceClass} | ${index.data.rootStyle}`);
check('首页 题量', () => `${index.data.total} 题 / ${index.data.chapterCount} 章`);

// 2) 切换夜间 + 大字号
appearance.set({ theme: 'night', size: 'l' });
index.onShow();
check('首页 夜间大字号', () => `${index.data.appearanceClass} | ${index.data.rootStyle}`);
check('导航栏跟随主题', () => JSON.stringify(calls.nav[calls.nav.length - 1]));
check('底部栏跟随主题', () => JSON.stringify(calls.tab[calls.tab.length - 1]));

// 2.5) 题型专练
index.switchSubject({ currentTarget: { dataset: { id: 'maogai' } } });
index.startMode({ currentTarget: { dataset: { mode: 'multiple' } } });
check('多选专练组卷', () => {
    const id = calls.navUrl.split('session=')[1];
    const session = store.getSession(id);
    const types = question.getByIds(session.questionIds).map((item) => item.type);
    return `${session.questionIds.length} 题 / 全部多选=${types.every((type) => type === 'multiple')}`;
});
index.startMode({ currentTarget: { dataset: { mode: 'single' } } });
check('单选专练组卷', () => {
    const id = calls.navUrl.split('session=')[1];
    const session = store.getSession(id);
    const types = question.getByIds(session.questionIds).map((item) => item.type);
    return `${session.questionIds.length} 题 / 全部单选=${types.every((type) => type === 'single')}`;
});
index.switchSubject({ currentTarget: { dataset: { id: 'xixin' } } });

// 3) 答题页
const practice = loadPage('pages/practice/practice.js');
practice.onLoad({ session: session.id });
practice.onShow();
check('答题页 字号', () => `题干 ${practice.data.questionFontSize} / 选项 ${practice.data.optionFontSize} / 解析 ${practice.data.analysisFontSize}`);
practice.selectOption({ currentTarget: { dataset: { key: practice.data.viewOptions[0].key } } });
check('答题页 判题', () => `${practice.data.feedbackTitle} | ${practice.data.submitted}`);

check('解析默认收起', () => `showExplanation=${practice.data.showExplanation}`);
practice.toggleExplanation();
check('解析可展开', () => `showExplanation=${practice.data.showExplanation}`);
practice.toggleExplanation();

const prefModule = require(path.join(root, 'utils/prefs.js'));
const beforeIndex = practice.data.currentIndex;
practice.onTouchStart({ touches: [{ clientX: 300, clientY: 300 }] });
practice.onTouchEnd({ changedTouches: [{ clientX: 160, clientY: 305 }] });
check('左滑下一题', () => `${beforeIndex} → ${practice.data.currentIndex}`);
practice.onTouchStart({ touches: [{ clientX: 120, clientY: 300 }] });
practice.onTouchEnd({ changedTouches: [{ clientX: 260, clientY: 296 }] });
check('右滑上一题', () => `${practice.data.currentIndex} 回到原位`);
check('竖向滚动不触发翻页', () => {
    const at = practice.data.currentIndex;
    practice.onTouchStart({ touches: [{ clientX: 300, clientY: 200 }] });
    practice.onTouchEnd({ changedTouches: [{ clientX: 260, clientY: 420 }] });
    return practice.data.currentIndex === at ? '未翻页' : '误触发';
});

practice.slashQuestion();
check('斩题写入', () => `${practice.data.slashed} | ${!!store.load().slashed[practice.data.current.id]}`);

// 背题模式
const reciteSession = store.createSession({
    mode: 'sequence',
    title: '背题测试',
    questions: question.getSubject('xixin').questions.slice(10, 13),
});
const recitePage = loadPage('pages/practice/practice.js');
recitePage.onLoad({ session: reciteSession.id });
prefModule.set({ recite: false });
recitePage.onShow();
check('默认做题模式', () => `recite=${recitePage.data.recite} / 解析展开=${recitePage.data.showExplanation}`);
recitePage.switchMode({ currentTarget: { dataset: { mode: 'recite' } } });
check('背题展开答案', () => {
    const marked = recitePage.data.viewOptions.filter((item) => item.stateClass === 'option-correct').length;
    return `标记 ${marked} 项 / 解析展开=${recitePage.data.showExplanation}`;
});
recitePage.selectOption({ currentTarget: { dataset: { key: recitePage.data.viewOptions[1].key } } });
check('背题不记录作答', () => `submitted=${recitePage.data.submitted} / 记录=${Object.keys(store.load().records).length}`);
recitePage.switchMode({ currentTarget: { dataset: { mode: 'quiz' } } });
check('切回做题', () => {
    const marked = recitePage.data.viewOptions.filter((item) => item.stateClass === 'option-correct').length;
    return `标记 ${marked} 项 / 解析展开=${recitePage.data.showExplanation}`;
});
prefModule.set({ recite: false });

// 带着背题偏好直接进入，首屏就要标出答案
prefModule.set({ recite: true });
const reciteEntry = loadPage('pages/practice/practice.js');
reciteEntry.onLoad({ session: reciteSession.id });
reciteEntry.onShow();
check('背题偏好直接进入即展开', () => {
    const marked = reciteEntry.data.viewOptions.filter((item) => item.stateClass === 'option-correct').length;
    return `recite=${reciteEntry.data.recite} / 标记 ${marked} 项 / 展开=${reciteEntry.data.showExplanation}`;
});
prefModule.set({ recite: false });

prefModule.set({ hideNav: true });
practice.onShow();
check('隐藏底栏生效', () => `hideNav=${practice.data.hideNav}`);
prefModule.set({ hideNav: false });

// 4) 题库
const catalog = loadPage('pages/catalog/catalog.js');
catalog.onLoad({ subject: 'maogai' });
catalog.onShow();
check('题库页', () => `${catalog.data.subjectShort} ${catalog.data.total} 题 / 显示 ${catalog.data.filteredCount}`);

// 5) 章节
const chapters = loadPage('pages/chapters/chapters.js');
chapters.onLoad({ subject: 'xixin' });
chapters.onShow();
check('章节页', () => `${chapters.data.subjectShort} ${chapters.data.chapters.length} 章`);

// 6) 我的 + 切回纯白
const dataPage = loadPage('pages/data/data.js');
dataPage.onShow();
check('我的页 默认', () => `${dataPage.data.themeId}/${dataPage.data.sizeId} | 预览 ${dataPage.data.previewQuestionSize}`);
dataPage.chooseTheme({ currentTarget: { dataset: { id: 'paper' } } });
dataPage.chooseSize({ currentTarget: { dataset: { id: 's' } } });
check('我的页 切换生效', () => `${dataPage.data.themeId}/${dataPage.data.sizeId} | ${dataPage.data.rootStyle} | 预览 ${dataPage.data.previewQuestionSize}`);
check('字号档位', () => `${require(path.join(root, 'utils/appearance.js')).SIZES.map((item) => item.name).join('/')}`);
dataPage.chooseSize({ currentTarget: { dataset: { id: 'xxl' } } });
check('超大字号生效', () => `${dataPage.data.rootStyle.split('--fs-q:')[1].split(';')[0]} | 预览 ${dataPage.data.previewQuestionSize}`);
practice.onShow();
check('答题页跟随超大字号', () => `题干 ${practice.data.questionFontSize} / 选项 ${practice.data.optionFontSize} / 解析 ${practice.data.analysisFontSize}`);
dataPage.chooseSize({ currentTarget: { dataset: { id: 'm' } } });
check('字体档位', () => require(path.join(root, 'utils/appearance.js')).FONTS.map((item) => item.name).join('/'));
dataPage.chooseFont({ currentTarget: { dataset: { id: 'kai' } } });
check('字体切换生效', () => `${dataPage.data.fontId} | ${dataPage.data.appearanceClass}`);
dataPage.chooseFont({ currentTarget: { dataset: { id: 'hei' } } });
check('字体回到黑体', () => `${dataPage.data.fontId} | ${dataPage.data.appearanceClass}`);

// 7) 主色随主题走
dataPage.chooseTheme({ currentTarget: { dataset: { id: 'kraft' } } });
check('牛皮纸主题', () => `${dataPage.data.appearanceClass} / 导航 ${calls.nav[calls.nav.length - 1].backgroundColor}`);
dataPage.chooseTheme({ currentTarget: { dataset: { id: 'green' } } });
check('护眼绿主题', () => `${dataPage.data.appearanceClass} / 导航 ${calls.nav[calls.nav.length - 1].backgroundColor}`);
dataPage.chooseTheme({ currentTarget: { dataset: { id: 'night' } } });
check('夜间主色提亮', () => `${dataPage.data.accentColor} / 底栏 ${calls.tab[calls.tab.length - 1].selectedColor}`);
dataPage.chooseTheme({ currentTarget: { dataset: { id: 'paper' } } });
check('回到纯白', () => `${dataPage.data.themeId}/${dataPage.data.sizeId} / ${dataPage.data.accentColor}`);
check('设置页无主色选择', () => {
    const wxml = require('fs').readFileSync(path.join(root, 'pages/data/data.wxml'), 'utf8');
    return wxml.indexOf('chooseAccent') === -1 ? '已移除' : '仍存在';
});

// 7.5) 已斩：筛选可达 + 可恢复
const slashTarget = question.getSubject('mayuan').questions[2];
store.toggleSlash(slashTarget.id);
const slashPage = loadPage('pages/catalog/catalog.js');
slashPage.onLoad({ subject: 'mayuan' });
slashPage.onShow();
slashPage.selectFilter({ currentTarget: { dataset: { filter: 'slashed' } } });
check('已斩筛选可点开', () => `${slashPage.data.filter} / ${slashPage.data.filteredCount} 题`);
const slashedItem = slashPage.data.chapters.flatMap((c) => c.questions)[0] || {};
check('已斩题目带恢复入口', () => `${slashedItem.id} ${slashedItem.statusText} isSlashed=${slashedItem.isSlashed}`);
slashPage.restoreQuestion({ currentTarget: { dataset: { id: slashTarget.id } } });
check('恢复斩题', () => `已斩=${!!store.load().slashed[slashTarget.id]} / 列表 ${slashPage.data.filteredCount} 题`);

// 7.6) 回归：备份恢复 / 学科切换 / 斩题定时器 / 本地文件清理
const backupUtil = require(path.join(root, 'utils/backup.js'));
const exportUtil = require(path.join(root, 'utils/export.js'));

check('恢复备份保留斩题', () => {
    const target = question.getSubject('xixin').questions[3];
    store.toggleSlash(target.id);
    const snapshot = JSON.parse(JSON.stringify(store.load()));
    store.replaceState(snapshot);
    const kept = !!store.load().slashed[target.id];
    store.toggleSlash(target.id);
    if (!kept) throw new Error('斩题状态在恢复后丢失');
    return 'slashed 保留';
});

check('切换学科清空会话上下文', () => {
    storage.sizheng_catalog_context_v1 = { sessionId: session.id };
    storage.sizheng_catalog_jump_v1 = { sessionId: session.id, questionId: 20001 };
    const page = loadPage('pages/catalog/catalog.js');
    page.onLoad({ subject: 'mayuan' });
    if (page.activeSessionId !== session.id) throw new Error('未读到会话上下文');
    page.switchSubject({ currentTarget: { dataset: { id: 'maogai' } } });
    if (page.activeSessionId) throw new Error('activeSessionId 未清空');
    if (storage.sizheng_catalog_context_v1 || storage.sizheng_catalog_jump_v1) {
        throw new Error('上下文存储未清理');
    }
    return 'context 已清空';
});

check('斩题跳转定时器可清理', () => {
    const fresh = store.createSession({
        mode: 'sequence',
        title: '斩题定时器测试',
        questions: question.getSubject('xixin').questions.slice(20, 23),
    });
    const page = loadPage('pages/practice/practice.js');
    page.onLoad({ session: fresh.id });
    page.slashQuestion();
    if (!page.slashTimer) throw new Error('未创建自动跳题定时器');
    const slashedId = page.data.current.id;
    page.onUnload();
    if (page.slashTimer) throw new Error('离页后定时器未清理');
    store.toggleSlash(slashedId);
    return 'timer 已清理';
});

check('导出只保留最新一份', () => {
    userFiles.push('思政练习生错题_20260101_1000.docx');
    userFiles.push('思政练习生错题_20260102_1000.docx');
    userFiles.push('思政练习生学习档案_20260102_1000.json');
    const removed = exportUtil.pruneOldExports('思政练习生错题');
    const stale = userFiles.indexOf('思政练习生错题_20260101_1000.docx');
    const backupKept = userFiles.indexOf('思政练习生学习档案_20260102_1000.json');
    userFiles.length = 0;
    if (stale !== -1) throw new Error('旧导出未清理');
    if (backupKept === -1) throw new Error('误删备份文件');
    return `清理 ${removed} 个`;
});

check('备份只保留最新一份', () => {
    userFiles.push('思政练习生学习档案_20260101_1000.json');
    userFiles.push('思政练习生学习档案_20260102_1000.json');
    backupUtil.pruneOldBackups();
    const left = userFiles.length;
    userFiles.length = 0;
    if (left !== 1) throw new Error(`应保留 1 份，实际 ${left}`);
    return '保留 1 份';
});

check('续答卡片按学科隔离', () => {
    const other = store.createSession({
        mode: 'sequence',
        title: '毛中特 顺序练习',
        questions: question.getSubject('maogai').questions.slice(0, 5),
    });
    const page = loadPage('pages/index/index.js');
    store.setSubjectId('mayuan');
    page.onShow();
    const hiddenOnOther = !page.data.resumeSession;
    store.setSubjectId('maogai');
    page.onShow();
    const shownOnOwner = !!page.data.resumeSession
        && page.data.resumeSession.title.indexOf('毛中特') !== -1;
    store.setSubjectId('mayuan');
    store.completeSession(other.id);
    if (!hiddenOnOther) throw new Error('别的学科也显示了续答卡片');
    if (!shownOnOwner) throw new Error('本科目没有显示续答卡片');
    return '按学科隔离';
});

check('搜索防抖 200ms', () => {
    const page = loadPage('pages/catalog/catalog.js');
    page.onLoad({ subject: 'mayuan' });
    page.resetDirectory();
    const before = page.data.filteredCount;
    const target = question.getSubject('mayuan').questions[0];
    page.handleSearchInput({ detail: { value: String(target.id) } });
    if (!page.searchTimer) throw new Error('未创建防抖定时器');
    if (page.data.filteredCount !== before) throw new Error('输入后立即重建了列表，防抖未生效');
    page.flushSearch();
    const after = page.data.filteredCount;
    page.onUnload();
    if (after !== 1) throw new Error(`落定后应命中 1 题，实际 ${after}`);
    return `${before} → ${after}`;
});

// 8) 全部页面不再抛错
results.forEach(([state, name, detail]) => console.log(`${state.padEnd(4)} ${name}  ${detail}`));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
