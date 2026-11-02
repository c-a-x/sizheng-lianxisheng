# -*- coding: utf-8 -*-
"""抽取毛概（学习通导出 docx）题库：单选 / 多选，答案来自高亮或“我的答案”。"""

import zipfile
import re
import pathlib
import json

DIR = pathlib.Path(r"E:\学习资料\课业笔记\大二下\毛概\毛概学习通--有答案")
OUT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25\scripts\bank\maogai_raw.json")

ENT = [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("\u3000", " "), ("\xa0", " ")]
CHAP_ORDER = [
    ("导论", "导论 马克思主义中国化时代化的历史进程与理论成果"),
    ("第一章", "第一章 毛泽东思想及其历史地位"),
    ("第二章", "第二章 新民主主义革命理论"),
    ("第三章", "第三章 社会主义改造理论"),
    ("第四章", "第四章 社会主义建设道路初步探索的理论成果"),
    ("第六章", "第六章 邓小平理论"),
    ("第七章", "第七章 “三个代表”重要思想"),
    ("第八章", "第八章 科学发展观"),
]
SECT_RE = re.compile(r"^[#*\s]*([一二三四])[.、．]\s*([单多]选题|判断题)")
QNUM_RE = re.compile(r"^(\d{1,3})\s*[.．、]\s*(.+)$")
OPT_RE = re.compile(r"^([A-H])\s*[.．、]\s*(.*)$")
ANS_RE = re.compile(r"^我?的?答案\s*[:：]\s*([A-H]+)")
KEY_RE = re.compile(r"^(?:正确答案|答案)\s*[:：]\s*([A-H]+)")
SCORE_RE = re.compile(r"^\d+(\.\d+)?\s*分$")


def clean(text):
    text = re.sub(r"<[^>]+>", "", text)
    for a, b in ENT:
        text = text.replace(a, b)
    return re.sub(r"[ \t]+", " ", text).strip()


def load_units(path):
    """返回 [{'text':..,'hl':bool}]，hl 表示段落内有高亮文字。"""
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    paras = re.findall(r"<w:p[ >].*?</w:p>|<w:p/>", xml, re.S)
    units = []
    for para in paras:
        runs = []
        hl = False
        for r in re.findall(r"<w:r[ >].*?</w:r>", para, re.S):
            txt = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", r, re.S))
            if not txt:
                continue
            marks = re.search(r"<w:rPr>(.*?)</w:rPr>", r, re.S)
            if marks and re.search(r'<w:highlight w:val="(yellow|green|cyan|magenta)"', marks.group(1)):
                hl = True
            runs.append(txt)
        text = clean("".join(runs))
        if text:
            units.append({"text": text, "hl": hl})
    return units


def parse_doc(path, chapter):
    units = load_units(path)
    questions = []
    sect = None
    for u in units:
        line = u["text"]
        s = SECT_RE.match(line)
        if s:
            kind = s.group(2)
            sect = "single" if kind == "单选题" else ("multiple" if kind == "多选题" else "judge")
            continue
        if sect not in ("single", "multiple"):
            continue
        m = QNUM_RE.match(line)
        if m and not SCORE_RE.match(m.group(1)):
            stem = m.group(2).strip()
            stem = re.sub(r"^\((?:单选题|多选题|判断题)[^)]*\)\s*", "", stem)
            stem = stem.replace("**", "").strip()
            if len(stem) > 3:
                questions.append({"num": int(m.group(1)), "stem": stem, "options": [], "answer": [], "type": sect})
                continue
        if not questions:
            continue
        cur = questions[-1]
        a = ANS_RE.match(line) or KEY_RE.match(line)
        if a:
            cur["answer"] = list(a.group(1))
            continue
        if SCORE_RE.match(line):
            continue
        o = OPT_RE.match(line)
        if o:
            body = o.group(2).replace("**", "").strip()
            parts = re.split(r"(?:答案解析|答案|解析)\s*[:：]", body, maxsplit=1)
            body = parts[0].strip()
            if len(parts) > 1:
                cur["explanation"] = (cur.get("explanation", "") + " " + parts[1].strip()).strip()
            cur["options"].append([o.group(1), body])
            if u["hl"]:
                cur.setdefault("hl", []).append(o.group(1))
            continue
        if re.match(r"^(?:答案解析|答案|解析)\s*[:：]", line):
            text = re.sub(r"^(?:答案解析|答案|解析)\s*[:：]", "", line).strip()
            cur["explanation"] = (cur.get("explanation", "") + " " + text).strip()
            continue
        if cur["options"]:
            cur["options"][-1][1] = (cur["options"][-1][1] + line.replace("**", "")).strip()
        else:
            cur["stem"] = (cur["stem"] + line.replace("**", "")).strip()

    for q in questions:
        if not q["answer"] and q.get("hl"):
            q["answer"] = sorted(set(q["hl"]))
        q.pop("hl", None)
    return {"chapter": chapter, "questions": questions}


def main():
    out = []
    for prefix, label in CHAP_ORDER:
        hits = [p for p in DIR.glob("*.docx") if p.name.startswith(prefix)]
        if not hits:
            print("MISSING FILE FOR", prefix)
            continue
        doc = parse_doc(hits[0], label)
        qs = doc["questions"]
        single = [q for q in qs if q["type"] == "single"]
        multi = [q for q in qs if q["type"] == "multiple"]
        bad = [q["num"] for q in qs if not q["answer"] or len(q["options"]) < 2]
        out.append(doc)
        print("%-6s %s | single %d | multi %d | bad %s" % (prefix, label, len(single), len(multi), bad[:8]))
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(d["questions"]) for d in out)
    print("TOTAL", total, "| single", sum(1 for d in out for q in d["questions"] if q["type"] == "single"),
          "| multi", sum(1 for d in out for q in d["questions"] if q["type"] == "multiple"))


if __name__ == "__main__":
    main()
