const KEY = 'sizheng_practice_prefs_v1';

const DEFAULT = {
    autoNext: true,
    hideNav: false,
    recite: false,
};

function get() {
    try {
        const saved = wx.getStorageSync(KEY);
        if (!saved || typeof saved !== 'object') return Object.assign({}, DEFAULT);
        return {
            autoNext: saved.autoNext !== false,
            hideNav: saved.hideNav === true,
            recite: saved.recite === true,
        };
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

module.exports = {
    get,
    set,
};
