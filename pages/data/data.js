const backup = require('../../utils/backup.js');
const store = require('../../utils/store.js');
const appearance = require('../../utils/appearance.js');
const prefs = require('../../utils/prefs.js');

const ROLLBACK_KEY = 'sizheng_quiz_rollback_v1';
const META_KEY = 'sizheng_quiz_backup_meta_v1';

function pad(value) {
    return value < 10 ? `0${value}` : `${value}`;
}

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readMeta() {
    try {
        const value = wx.getStorageSync(META_KEY);
        return value && typeof value === 'object' ? value : {};
    } catch (error) {
        return {};
    }
}

function saveMeta(meta) {
    try {
        wx.setStorageSync(META_KEY, meta);
    } catch (error) {
        // 备份元信息不影响主流程。
    }
}

function readRollback() {
    try {
        const value = wx.getStorageSync(ROLLBACK_KEY);
        return value && typeof value === 'object' && typeof value.text === 'string' ? value : null;
    } catch (error) {
        return null;
    }
}

Page({
    data: {
        themes: appearance.THEMES,
        sizes: appearance.SIZES,
        fonts: appearance.FONTS,
        themeId: 'paper',
        sizeId: 'm',
        fontId: 'hei',
        fontHint: '与学习通一致的系统黑体',
        accentColor: '#0b5394',
        autoNext: true,
        hideNav: false,
        themeHint: '默认，接近纸质书',
        appearanceClass: 'theme-paper size-m',
        rootStyle: '',
        previewQuestionSize: 31,
        previewOptionSize: 27,
        summary: {
            totalQuestions: 392,
            practiced: 0,
            wrong: 0,
            favorites: 0,
            sessions: 0,
            resumeSessions: 0,
        },
        lastExportText: '尚未导出',
        lastRestoreText: '尚未恢复',
        hasRollback: false,
        rollbackText: '',
        busy: false,
    },

    onShow() {
        this.applyAppearance();
        this.refresh();
    },

    applyAppearance() {
        const pref = appearance.get();
        const practicePrefs = prefs.get();
        this.setData({
            appearanceClass: appearance.classes(pref),
            rootStyle: appearance.rootStyle(pref),
            themeId: pref.theme,
            sizeId: pref.size,
            fontId: pref.font,
            fontHint: (appearance.FONTS.filter((item) => item.id === pref.font)[0] || {}).hint || '',
            themeHint: (appearance.THEMES.find((item) => item.id === pref.theme) || {}).hint || '',
            previewQuestionSize: appearance.fontScale(pref).question,
            previewOptionSize: appearance.fontScale(pref).option,
            accentColor: appearance.accentColor(pref),
            autoNext: practicePrefs.autoNext,
            hideNav: practicePrefs.hideNav,
        });
        appearance.applyChrome(pref);
    },

    chooseTheme(event) {
        appearance.set({ theme: event.currentTarget.dataset.id });
        this.applyAppearance();
    },

    toggleAutoNext(event) {
        prefs.set({ autoNext: !!event.detail.value });
        this.setData({ autoNext: !!event.detail.value });
    },

    toggleHideNav(event) {
        prefs.set({ hideNav: !!event.detail.value });
        this.setData({ hideNav: !!event.detail.value });
    },

    chooseFont(event) {
        appearance.set({ font: event.currentTarget.dataset.id });
        this.applyAppearance();
    },

    chooseSize(event) {
        appearance.set({ size: event.currentTarget.dataset.id });
        this.applyAppearance();
    },

    refresh() {
        const summary = backup.getStateSummary(store.load());
        const meta = readMeta();
        const rollback = readRollback();
        this.setData({
            summary,
            lastExportText: formatDateTime(meta.lastExportAt) || '尚未导出',
            lastRestoreText: formatDateTime(meta.lastRestoreAt) || '尚未恢复',
            hasRollback: !!rollback,
            rollbackText: rollback ? `回滚点：${formatDateTime(rollback.createdAt)}` : '',
        });
    },

    exportBackup() {
        if (this.data.busy) return;
        let file;
        try {
            file = backup.writeBackupFileSync(store.load(), new Date());
        } catch (error) {
            wx.showToast({ title: '备份文件生成失败', icon: 'none' });
            return;
        }
        this.pendingBackup = file;
        if (typeof wx.shareFileMessage !== 'function') {
            this.offerCopyBackup(file);
            return;
        }
        try {
            wx.shareFileMessage({
                filePath: file.filePath,
                fileName: file.fileName,
                success: () => this.markExported(),
                fail: (error) => {
                    const message = String(error && error.errMsg ? error.errMsg : '');
                    if (message.indexOf('cancel') !== -1) return;
                    this.offerCopyBackup(file);
                },
            });
        } catch (error) {
            this.offerCopyBackup(file);
        }
    },

    markExported() {
        const meta = readMeta();
        meta.lastExportAt = Date.now();
        saveMeta(meta);
        this.setData({ lastExportText: formatDateTime(meta.lastExportAt) });
        wx.showToast({ title: '学习档案已发送', icon: 'success' });
    },

    offerCopyBackup(file) {
        wx.showModal({
            title: '文件发送不可用',
            content: '可以复制档案内容，再粘贴保存为 .json 文件。',
            confirmText: '复制档案',
            success: (result) => {
                if (!result.confirm) return;
                wx.setClipboardData({
                    data: file.text,
                    success: () => {
                        wx.showModal({
                            title: '已复制学习档案',
                            content: '请粘贴到文件传输助手或文本文件，并保存为 .json 备份。',
                            showCancel: false,
                        });
                    },
                    fail: () => {
                        wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' });
                    },
                });
            },
        });
    },

    chooseRestoreFile() {
        if (this.data.busy) return;
        if (typeof wx.chooseMessageFile !== 'function') {
            wx.showToast({ title: '当前微信版本不支持选择文件', icon: 'none' });
            return;
        }
        wx.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: ['json'],
            success: (result) => {
                const file = result.tempFiles && result.tempFiles[0];
                if (!file || !file.path) return;
                if (file.size > backup.MAX_BACKUP_BYTES) {
                    wx.showToast({ title: '备份文件超过 2MB', icon: 'none' });
                    return;
                }
                this.readRestoreFile(file);
            },
            fail: (error) => {
                const message = String(error && error.errMsg ? error.errMsg : '');
                if (message.indexOf('cancel') !== -1) return;
                if (message.toLowerCase().indexOf('privacy') !== -1) {
                    wx.showModal({
                        title: '需要文件读取授权',
                        content: '恢复学习档案需要读取你主动选择的文件。请同意小程序的隐私保护指引后重试。',
                        showCancel: false,
                    });
                    return;
                }
                wx.showToast({ title: '文件选择失败', icon: 'none' });
            },
        });
    },

    readRestoreFile(file) {
        this.setData({ busy: true });
        wx.showLoading({ title: '正在校验档案', mask: true });
        wx.getFileSystemManager().readFile({
            filePath: file.path,
            encoding: 'utf8',
            success: (result) => {
                wx.hideLoading();
                this.setData({ busy: false });
                const validation = backup.validateBackupText(result.data);
                if (!validation.ok) {
                    wx.showModal({
                        title: '无法恢复',
                        content: validation.error,
                        showCancel: false,
                    });
                    return;
                }
                this.pendingRestore = validation;
                this.confirmRestore(validation);
            },
            fail: () => {
                wx.hideLoading();
                this.setData({ busy: false });
                wx.showToast({ title: '文件读取失败', icon: 'none' });
            },
        });
    },

    confirmRestore(validation) {
        const summary = validation.summary;
        const exportedAt = validation.exportedAt ? formatDateTime(new Date(validation.exportedAt).getTime()) : '未知';
        wx.showModal({
            title: '恢复学习档案？',
            content: `备份时间：${exportedAt}\n已练 ${summary.practiced} 题，错题 ${summary.wrong}，收藏 ${summary.favorites}，断点 ${summary.resumeSessions}。\n\n恢复后会覆盖本机当前记录，并保留一份可撤销回滚点。`,
            confirmText: '确认恢复',
            success: (result) => {
                if (result.confirm) this.applyRestore(validation);
            },
        });
    },

    applyRestore(validation) {
        let rollback;
        try {
            rollback = backup.buildBackup(store.load(), new Date());
        } catch (error) {
            wx.showToast({ title: '无法创建回滚快照，已取消', icon: 'none' });
            return;
        }
        try {
            wx.setStorageSync(ROLLBACK_KEY, {
                createdAt: Date.now(),
                text: rollback.text,
            });
        } catch (error) {
            wx.showToast({ title: '无法创建回滚快照，已取消', icon: 'none' });
            return;
        }
        if (!store.replaceState(validation.state)) {
            wx.removeStorageSync(ROLLBACK_KEY);
            wx.showToast({ title: '学习档案恢复失败', icon: 'none' });
            return;
        }
        const meta = readMeta();
        meta.lastRestoreAt = Date.now();
        saveMeta(meta);
        this.refresh();
        wx.showToast({ title: '学习档案已恢复', icon: 'success' });
    },

    undoRestore() {
        const rollback = readRollback();
        if (!rollback) return;
        const validation = backup.validateBackupText(rollback.text);
        if (!validation.ok) {
            wx.removeStorageSync(ROLLBACK_KEY);
            this.refresh();
            wx.showToast({ title: '回滚快照已损坏', icon: 'none' });
            return;
        }
        wx.showModal({
            title: '撤销上次恢复？',
            content: `将回到 ${formatDateTime(rollback.createdAt)} 的本机记录。当前的导入数据会被覆盖。`,
            confirmText: '撤销恢复',
            success: (result) => {
                if (!result.confirm) return;
                if (!store.replaceState(validation.state)) {
                    wx.showToast({ title: '撤销恢复失败', icon: 'none' });
                    return;
                }
                wx.removeStorageSync(ROLLBACK_KEY);
                const meta = readMeta();
                delete meta.lastRestoreAt;
                saveMeta(meta);
                this.refresh();
                wx.showToast({ title: '已撤销上次恢复', icon: 'success' });
            },
        });
    },

    clearLearningData() {
        const summary = this.data.summary;
        wx.showModal({
            title: '清除全部学习记录？',
            content: `将删除 ${summary.practiced} 道已练记录、${summary.wrong} 道错题、${summary.favorites} 道收藏和练习断点。已导出的备份文件不受影响，此操作不可撤销。`,
            confirmText: '清除记录',
            success: (result) => {
                if (!result.confirm) return;
                if (!store.clearAll()) return;
                wx.removeStorageSync(ROLLBACK_KEY);
                wx.removeStorageSync(META_KEY);
                this.refresh();
                wx.showToast({ title: '学习记录已清除', icon: 'success' });
            },
        });
    },
});
