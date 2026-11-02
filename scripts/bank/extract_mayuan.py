# -*- coding: utf-8 -*-
"""从《2025版马原练习题》抽取单项选择题 + 每章答案册（稳健版）。"""

import zipfile
import re
import pathlib
import json

SRC = pathlib.Path(r"E:\学习资料\课业笔记\大二上\马原习题集\2025版马原练习题.docx")
OUT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25\scripts\bank\mayuan_raw.json")

ENT = [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("\u3000", " "), ("\xa0", " ")]
CHAP_RE = re.compile(r"^(导\s*论|第[一二三四五六七]章)\s*(.*)$")
SECT_RE = re.compile(r"^([一二三])\s*[、.]\s*(单项选择题|多项选择题|思考题)")
NUM_RE = re.compile(r"(?<![0-9])(\d{1,3})\s*[.．、]\s*")
ANS_RE = re.compile(r"(\d+)\s*[.．、]\s*([A-H]{1,8})(?![A-Za-z])")
CAND_RE = re.compile(r"([A-H])\s*[.．、]|([A-H])(?=[\u4e00-\u9fff（(《])")
BLANK_RE = re.compile(r"[（(]\s*[）)]")


def clean(text):
    text = re.sub(r"<[^>]+>", "", text)
    for a, b in ENT:
        text = text.replace(a, b)
    return re.sub(r"[ \t]+", " ", text).strip()


def load_lines(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    paras = re.findall(r"<w:p[ >].*?</w:p>|<w:p/>", xml, re.S)
    lines = []
    for para in paras:
        runs = re.findall(r"<w:t[^>]*>(.*?)</w:t>", para, re.S)
        if not runs:
            continue
        text = clean("".join(runs))
        if text:
            lines.append(text)
    return lines


def split_options(line):
    cands = [(m.group(1) or m.group(2), m.start(), m.end()) for m in CAND_RE.finditer(line)]
    if not cands or cands[0][1] != 0:
        return None
    want = ord(cands[0][0]) - 65
    marks = []
    for letter, start, end in cands:
        if ord(letter) - 65 != want:
            continue
        marks.append((want, start, end))
        want += 1
    out = []
    for i, (idx, start, end) in enumerate(marks):
        stop = marks[i + 1][1] if i + 1 < len(marks) else len(line)
        out.append(("ABCDEFGH"[idx], line[end:stop].strip(" 　")))
    return out


def find_marker(text, expected):
    m = NUM_RE.search(text)
    while m:
        if int(m.group(1)) == expected:
            return m
        m = NUM_RE.search(text, m.end())
    return None


def chunks_of(line, expected):
    out = []
    pos = 0
    for _ in range(8):
        m = find_marker(line[pos:], expected)
        if not m:
            if pos < len(line):
                out.append(("text", line[pos:]))
            break
        s = pos + m.start()
        if s > pos:
            out.append(("text", line[pos:s]))
        out.append(("start", None))
        pos = pos + m.end()
        if pos >= len(line):
            break
    return out


def parse(lines):
    chapters = []
    cur = None
    sect = None
    mode = "q"
    expected = {"single": 1, "multiple": 1}
    pending = False

    for line in lines:
        if "····" in line or re.match(r"^目\s*录", line):
            continue
        m = CHAP_RE.match(line)
        if m and len(line) < 40:
            name = m.group(1).replace(" ", "")
            if m.group(2).strip():
                name += " " + m.group(2).strip()
            name = re.sub(r"\s+", " ", name).strip()
            if cur is None or cur["name"] != name:
                cur = {"name": name, "single": [], "multiple": [], "ans_single": {}, "ans_multiple": {}}
                chapters.append(cur)
                mode = "q"
                sect = None
                expected = {"single": 1, "multiple": 1}
                pending = False
            else:
                mode = "a"
            continue
        if cur is None:
            continue
        s = SECT_RE.match(line)
        if s:
            sect = {"单项选择题": "single", "多项选择题": "multiple", "思考题": "essay"}[s.group(2)]
            continue
        if mode == "a":
            if sect in ("single", "multiple"):
                groups = ANS_RE.findall(line)
                rest = ANS_RE.sub("", line).strip()
                if groups and rest == "":
                    target = cur["ans_single" if sect == "single" else "ans_multiple"]
                    for num, ans in groups:
                        target[int(num)] = list(ans)
            continue
        if sect not in ("single", "multiple"):
            continue

        key = sect
        for kind, text in chunks_of(line, expected[key]):
            if kind == "start":
                cur[key].append({"num": expected[key], "stem": "", "options": []})
                expected[key] += 1
                pending = True
                continue
            body = text.strip()
            if not body or not cur[key]:
                continue
            target = cur[key][-1]
            if pending and not target["options"] and not target["stem"]:
                target["stem"] = body
                pending = False
                continue
            opts = split_options(body)
            if opts:
                target["options"].extend(opts)
                pending = False
                continue
            # 无题号的整行：含括号空位视为漏号题干，否则视为上一选项的换行续写
            if BLANK_RE.search(body) and len(body) >= 8:
                cur[key].append({"num": expected[key], "stem": body, "options": []})
                expected[key] += 1
                pending = False
            elif target["options"]:
                k, t = target["options"][-1]
                target["options"][-1] = (k, (t + body).strip())
            else:
                target["stem"] = (target["stem"] + body).strip()
    return chapters


def main():
    lines = load_lines(SRC)
    chapters = parse(lines)
    for c in chapters:
        for k in ("ans_single", "ans_multiple"):
            c[k] = {int(n): v for n, v in c[k].items()}
    OUT.write_text(json.dumps(chapters, ensure_ascii=False, indent=1), encoding="utf-8")

    total_q = total_a = 0
    for c in chapters:
        qs = c["single"]
        total_q += len(qs)
        total_a += len(c["ans_single"])
        issues = []
        for q in qs:
            keys = [o[0] for o in q["options"]]
            if len(q["options"]) != 4:
                issues.append((q["num"], "opts%d" % len(q["options"])))
            ans = c["ans_single"].get(q["num"])
            if not ans:
                issues.append((q["num"], "noans"))
            elif any(k not in keys for k in ans):
                issues.append((q["num"], "ansout"))
            if not q["stem"]:
                issues.append((q["num"], "nostem"))
            if any(not t for _, t in q["options"]):
                issues.append((q["num"], "emptyopt"))
        print(c["name"], "| q", len(qs), "| ans", len(c["ans_single"]), "| issues", issues[:8])
    print("TOTAL_SINGLE", total_q, "TOTAL_ANS", total_a)


if __name__ == "__main__":
    main()
