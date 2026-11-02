function scrollPageTo(scrollTop, duration) {
    if (typeof wx === 'undefined' || typeof wx.pageScrollTo !== 'function') return false;
    wx.pageScrollTo({
        scrollTop: scrollTop || 0,
        duration: typeof duration === 'number' ? duration : 0,
    });
    return true;
}

function setTitle(title) {
    if (typeof wx === 'undefined' || typeof wx.setNavigationBarTitle !== 'function') return false;
    wx.setNavigationBarTitle({ title });
    return true;
}

module.exports = {
    scrollPageTo,
    setTitle,
};
