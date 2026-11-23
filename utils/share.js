/**
 * 分享文案统一出口。
 *
 * 小程序里「转发给朋友」只有在页面的 Page 中定义 onShareAppMessage 之后才会点亮，
 * 「分享到朋友圈」需要 onShareTimeline；写在 App() 里不会报错，但完全不生效。
 * 这里只做自然描述，不含分享解锁、助力、集赞一类诱导性文案。
 */

const HOME_PATH = '/pages/index/index';

const DEFAULT_TITLE = '思政练习生｜马原·毛中特·新思想 1097 题';

function buildMessage(options) {
    const opts = options || {};
    return {
        title: opts.title || DEFAULT_TITLE,
        path: opts.path || HOME_PATH,
    };
}

function buildTimeline(options) {
    const opts = options || {};
    return {
        title: opts.title || DEFAULT_TITLE,
        query: opts.query || '',
    };
}

module.exports = {
    HOME_PATH,
    DEFAULT_TITLE,
    buildMessage,
    buildTimeline,
};
