const KEY = 'sizheng_appearance_v1';

const THEMES = [
    { id: 'paper', name: '纯白', hint: '干净的白纸底，最清亮' },
    { id: 'warm', name: '米黄', hint: '羊皮纸色，亮度低一档，久看不刺眼' },
    { id: 'kraft', name: '牛皮纸', hint: '暖褐纸色，最接近手写笔记' },
    { id: 'green', name: '护眼绿', hint: '低饱和绿底，长时间阅读最省力' },
    { id: 'night', name: '夜间', hint: '暗底浅字，熄灯后使用' },
];

const FONTS = [
    { id: 'hei', name: '黑体', hint: '与学习通一致的系统黑体，默认' },
    { id: 'song', name: '宋体', hint: '衬线，接近教材与试卷' },
    { id: 'kai', name: '楷体', hint: '手写感，适合短时阅读' },
];

const SIZES = [
    { id: 's', name: '小' },
    { id: 'm', name: '中' },
    { id: 'l', name: '大' },
    { id: 'xl', name: '特大' },
    { id: 'xxl', name: '超大' },
];

const DEFAULT = { theme: 'paper', size: 'm', font: 'hei' };

const FONT_SCALE = {
    s: { question: 28, option: 25, analysis: 22 },
    m: { question: 31, option: 27, analysis: 24 },
    l: { question: 35, option: 31, analysis: 28 },
    xl: { question: 39, option: 35, analysis: 31 },
    xxl: { question: 43, option: 38, analysis: 34 },
};

const CHROME = {
    paper: { nav: '#ffffff', front: '#000000', tab: '#ffffff', tabInk: '#6b6b66', tabActive: '#0b5394', border: 'black' },
    warm: { nav: '#f1e6cd', front: '#000000', tab: '#fffdf5', tabInk: '#6b6149', tabActive: '#1a4f7d', border: 'black' },
    kraft: { nav: '#e8dbbc', front: '#000000', tab: '#f7efdb', tabInk: '#655636', tabActive: '#17496f', border: 'black' },
    green: { nav: '#e9f1e5', front: '#000000', tab: '#fbfdf9', tabInk: '#5c6852', tabActive: '#145a60', border: 'black' },
    night: { nav: '#121212', front: '#ffffff', tab: '#171717', tabInk: '#98988f', tabActive: '#7fb2e5', border: 'white' },
};

function get() {
    try {
        const saved = wx.getStorageSync(KEY);
        if (!saved || typeof saved !== 'object') return Object.assign({}, DEFAULT);
        const theme = THEMES.some((item) => item.id === saved.theme) ? saved.theme : DEFAULT.theme;
        const size = SIZES.some((item) => item.id === saved.size) ? saved.size : DEFAULT.size;
        const font = FONTS.some((item) => item.id === saved.font) ? saved.font : DEFAULT.font;
        return { theme, size, font };
    } catch (error) {
        return Object.assign({}, DEFAULT);
    }
}

function set(patch) {
    const next = Object.assign({}, get(), patch || {});
    try {
        wx.setStorageSync(KEY, next);
    } catch (error) {
        return get();
    }
    return next;
}

function classes(preference) {
    const current = preference || get();
    const font = FONTS.some((item) => item.id === current.font) ? current.font : DEFAULT.font;
    return `theme-${current.theme} size-${current.size} font-${font}`;
}

function fontScale(preference) {
    const current = preference || get();
    return FONT_SCALE[current.size] || FONT_SCALE.m;
}

/* 主色由主题决定，不再提供独立选择 */
function accentColor(preference) {
    const current = preference || get();
    return (CHROME[current.theme] || CHROME.paper).tabActive;
}

/* 字号写进页面根节点，页面样式只引用变量 */
function rootStyle(preference) {
    const current = preference || get();
    const scale = fontScale(current);
    const list = Math.max(21, scale.option - 4);
    return [
        `--fs-q:${scale.question}rpx`,
        `--fs-o:${scale.option}rpx`,
        `--fs-n:${scale.analysis}rpx`,
        `--fs-s:${list}rpx`,
    ].join(';') + ';';
}

function applyChrome(preference) {
    const current = preference || get();
    const theme = CHROME[current.theme] || CHROME.paper;
    if (typeof wx === 'undefined') return;
    if (typeof wx.setNavigationBarColor === 'function') {
        wx.setNavigationBarColor({
            frontColor: theme.front,
            backgroundColor: theme.nav,
            fail() {},
        });
    }
    if (typeof wx.setBackgroundColor === 'function') {
        wx.setBackgroundColor({
            backgroundColor: theme.tab,
            backgroundColorTop: theme.nav,
            backgroundColorBottom: theme.tab,
            fail() {},
        });
    }
    if (typeof wx.setTabBarStyle === 'function') {
        wx.setTabBarStyle({
            color: theme.tabInk,
            selectedColor: theme.tabActive,
            backgroundColor: theme.tab,
            borderStyle: theme.border,
            fail() {},
        });
    }
}

module.exports = {
    THEMES,
    SIZES,
    FONTS,
    get,
    set,
    classes,
    fontScale,
    accentColor,
    rootStyle,
    applyChrome,
    applyNavigationBar: applyChrome,
};
