/**
 * 代码静态审计：事件绑定、重复方法、页面完整性、模块调用、语法与 JSON。
 * 用法：node scripts/audit_code.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const out = { missingHandlers: [], dupMethods: [], pageIssues: [], moduleIssues: [], syntax: [], json: [] };

function walk(dir, filter) {
    const res = [];
    fs.readdirSync(dir).forEach((f) => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            if (!/node_modules|\.git|\.workbuddy|design|docs/.test(p)) res.push(...walk(p, filter));
        } else if (filter(p)) res.push(p);
    });
    return res;
}

// 1) 事件绑定 → 方法存在 + 重复方法名
const pages = fs.readdirSync(path.join(root, 'pages')).filter((d) => fs.statSync(path.join(root, 'pages', d)).isDirectory());
const evtRe = /(?:bind|catch)(?::)?([a-z]+)="([A-Za-z_$][\w$]*)"/g;

pages.forEach((name) => {
    const dir = path.join(root, 'pages', name);
    const files = fs.readdirSync(dir);
    const jsFile = files.find((f) => f.endsWith('.js'));
    const wxmlFile = files.find((f) => f.endsWith('.wxml'));
    if (!jsFile || !wxmlFile) {
        out.pageIssues.push(`${name}: js=${!!jsFile} wxml=${!!wxmlFile}`);
        return;
    }
    const js = fs.readFileSync(path.join(dir, jsFile), 'utf8');
    const wxml = fs.readFileSync(path.join(dir, wxmlFile), 'utf8');

    const methods = new Set();
    const seen = {};
    const methodRe = /^    ([A-Za-z_$][\w$]*)\s*(?:\(|:\s*function)/gm;
    let m;
    while ((m = methodRe.exec(js))) {
        methods.add(m[1]);
        seen[m[1]] = (seen[m[1]] || 0) + 1;
    }
    Object.keys(seen).forEach((k) => {
        if (seen[k] > 1 && k !== 'if') out.dupMethods.push(`${name}.${k} ×${seen[k]}`);
    });

    let e;
    const bound = new Set();
    while ((e = evtRe.exec(wxml))) bound.add(e[2]);
    bound.forEach((fn) => {
        if (!methods.has(fn)) out.missingHandlers.push(`${name}: ${fn}`);
    });
});

// 2) app.json 页面完整性
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
app.pages.forEach((p) => {
    ['.js', '.json', '.wxml', '.wxss'].forEach((ext) => {
        if (!fs.existsSync(path.join(root, p + ext))) out.pageIssues.push(`缺文件 ${p}${ext}`);
    });
});
(app.tabBar ? app.tabBar.list : []).forEach((t) => {
    if (!app.pages.includes(t.pagePath)) out.pageIssues.push(`tabBar 未注册 ${t.pagePath}`);
});

// 3) 模块调用 → 导出存在
const utilExports = {};
fs.readdirSync(path.join(root, 'utils')).filter((f) => f.endsWith('.js')).forEach((f) => {
    try {
        utilExports[f.replace('.js', '')] = new Set(Object.keys(require(path.join(root, 'utils', f))));
    } catch (err) {
        utilExports[f.replace('.js', '')] = new Set();
        out.moduleIssues.push(`utils/${f} 加载失败: ${err.message}`);
    }
});
const pageJs = walk(path.join(root, 'pages'), (p) => p.endsWith('.js'));
pageJs.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const reqs = {};
    [...src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['"]([^'"]+)['"]\)/g)].forEach((m) => {
        reqs[m[1]] = path.basename(m[2]).replace('.js', '');
    });
    Object.keys(reqs).forEach((v) => {
        const mod = reqs[v];
        if (!(mod in utilExports)) return;
        const re = new RegExp('\\b' + v + '\\.([A-Za-z_$][\\w$]*)', 'g');
        let m;
        while ((m = re.exec(src))) {
            const prop = m[1];
            if (['js', 'json', 'wxss'].includes(prop)) continue;
            if (!utilExports[mod].has(prop)) out.moduleIssues.push(`${path.relative(root, f)}: ${v}.${prop} 未导出`);
        }
    });
});

// 4) 语法与 JSON
walk(root, (p) => p.endsWith('.js')).forEach((f) => {
    try {
        new Function(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
        out.syntax.push(`${path.relative(root, f)}: ${e.message}`);
    }
});
walk(root, (p) => p.endsWith('.json')).forEach((f) => {
    try {
        JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
        out.json.push(`${path.relative(root, f)}: ${e.message}`);
    }
});

const titles = {
    missingHandlers: '事件绑定缺方法',
    dupMethods: '重复方法名',
    pageIssues: '页面文件问题',
    moduleIssues: '模块调用问题',
    syntax: 'JS 语法错误',
    json: 'JSON 格式错误',
};
let total = 0;
Object.keys(titles).forEach((k) => {
    total += out[k].length;
    console.log(`[${titles[k]}] ${out[k].length ? out[k].length + ' 条' : '无'}`);
    out[k].slice(0, 8).forEach((x) => console.log('   ', x));
});
console.log(total === 0 ? '\n审计通过，未发现问题' : `\n共 ${total} 条待处理`);
