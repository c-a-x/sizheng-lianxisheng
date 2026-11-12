# -*- coding: utf-8 -*-
"""题库质量体检：答案结构、解析与答案一致性、重复题、选项异常。"""
import json, re, collections, subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = """
const q = require('./utils/question.js');
const out = [];
q.subjects.forEach(s => {
  s.questions.forEach(x => out.push({
    id: x.id, subject: s.short, chapter: x.chapter, type: x.type,
    question: x.question, options: x.options, answer: x.answer,
    solution: x.solution || '', tip: x.memoryTip || '', oa: x.optionAnalysis || {}
  }));
});
process.stdout.write(JSON.stringify(out));
"""
raw = subprocess.run(["node", "-e", JS], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
if raw.returncode != 0:
    print("取数失败:", raw.stderr[:500]); sys.exit(1)
data = json.loads(raw.stdout)
print("题目总数", len(data))

issues = collections.defaultdict(list)

# 1) 结构
for q in data:
    keys = [o["key"] for o in q["options"]]
    if len(set(keys)) != len(keys):
        issues["选项键重复"].append(q["id"])
    if len(keys) < 2:
        issues["选项不足"].append(q["id"])
    if not q["answer"]:
        issues["无答案"].append(q["id"])
    for a in q["answer"]:
        if a not in keys:
            issues["答案不在选项"].append((q["id"], a))
    if q["type"] == "single" and len(q["answer"]) != 1:
        issues["单选答案不唯一"].append((q["id"], q["answer"]))
    if q["type"] == "multiple" and len(q["answer"]) < 2:
        issues["多选答案只有一个"].append((q["id"], q["answer"]))
    for o in q["options"]:
        t = o["text"].strip()
        if len(t) < 1:
            issues["空选项"].append((q["id"], o["key"]))
        if re.search(r"(解析|答案)\s*[:：]", t):
            issues["选项含解析残留"].append((q["id"], o["key"], t[:40]))
        if t == o["key"]:
            issues["选项文本等于字母"].append((q["id"], o["key"]))

# 2) 解析结论与答案矛盾
CONC = [re.compile(r"故\s*选\s*([A-H]{1,6})"), re.compile(r"正确答案\s*[是为:：]?\s*([A-H]{1,6})"),
        re.compile(r"答案\s*[是为:：]\s*([A-H]{1,6})"), re.compile(r"应\s*选\s*([A-H]{1,6})"),
        re.compile(r"当选\s*([A-H]{1,6})")]
for q in data:
    sol = q["solution"] or ""
    hit = None
    for pat in CONC:
        m = pat.search(sol)
        if m:
            hit = m.group(1); break
    if hit:
        a = set(hit); b = set(q["answer"])
        if a != b:
            issues["解析结论与答案不符"].append((q["id"], "解析:" + hit, "答案:" + "".join(q["answer"]), sol[-40:]))

# 3) 选项解析方向
NEG = re.compile(r"(表述错误|说法错误|错误|不符合|不符题意|排除|不选|无关|偷换|混淆|颠倒|夸大|缩小|不属于|不能)")
POS = re.compile(r"(表述正确|说法正确|入选|符合题意|正确|当选|符合)")
oa_reverse = []
for q in data:
    ans = set(q["answer"])
    for key, txt in (q["oa"] or {}).items():
        t = txt or ""
        if key in ans and NEG.search(t) and not POS.search(t):
            oa_reverse.append((q["id"], key, "正确项写成了错误", t[:50]))
        if key not in ans and POS.search(t) and not NEG.search(t):
            oa_reverse.append((q["id"], key, "错误项写成了正确", t[:50]))
if oa_reverse:
    issues["选项解析方向可疑"] = oa_reverse

# 4) 重复题干
def norm(s):
    return re.sub(r"[\s，。、；：？！,.;:?!（）()《》\"'“”‘’]", "", s or "")
groups = collections.defaultdict(list)
for q in data:
    groups[norm(q["question"])].append(q)
same_text_diff_ans = []
dup = []
for k, v in groups.items():
    if len(v) > 1:
        dup.append((v[0]["id"], len(v), v[0]["question"][:30]))
        answers = {tuple(sorted(x["answer"])) for x in v}
        if len(answers) > 1:
            same_text_diff_ans.append(([x["id"] for x in v], [ "".join(x["answer"]) for x in v], v[0]["question"][:40]))
if dup:
    issues["重复题干"].append(dup)
if same_text_diff_ans:
    issues["同题不同答案"] = same_text_diff_ans

# 5) 答案分布
for subj in sorted({q["subject"] for q in data}):
    c = collections.Counter()
    for q in data:
        if q["subject"] == subj:
            c["".join(sorted(q["answer"]))] += 1
    issues["答案分布_" + subj].append(dict(c.most_common(8)))

# 6) 记忆小注重复
tips = collections.Counter(q["tip"] for q in data if q["tip"])
dup_tips = [(t[:30], n) for t, n in tips.items() if n > 1]
if dup_tips:
    issues["记忆小注重复"].append(dup_tips[:10])

# 输出
print("\n===== 体检结果 =====")
for k in sorted(issues):
    v = issues[k]
    print(f"\n[{k}] {len(v)} 条")
    for item in v[:8]:
        print("   ", item)
