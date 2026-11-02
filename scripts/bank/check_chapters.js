const path = require('path');
const storage = { sizheng_subject_v1: 'maogai' };
global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; },
    showToast: () => {},
    pageScrollTo: () => {},
    navigateBack: () => {},
    navigateTo: (options) => console.log('NAV', options.url),
    setNavigationBarTitle: (options) => console.log('TITLE', options.title),
};
let config = null;
global.Page = (value) => { config = value; };
require(path.resolve('pages/chapters/chapters.js'));

const page = Object.assign({}, config);
page.data = JSON.parse(JSON.stringify(config.data || {}));
page.setData = function setData(update, callback) {
    Object.assign(this.data, update);
    if (callback) callback();
};
page.onLoad({ subject: 'maogai' });
page.onShow();
console.log('chapters', page.data.chapters.length);
console.log('first', JSON.stringify(page.data.chapters[0]));
console.log('subject', page.data.subjectShort, '| practiced', page.data.totalPracticed);
page.startChapter({ currentTarget: { dataset: { index: 7 } } });
