# -*- coding: utf-8 -*-
"""把抽好的马原 / 毛概原始数据转换成小程序题库格式。"""

import json
import pathlib
import re

ROOT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25")
MAYUAN_RAW = ROOT / "scripts" / "bank" / "mayuan_raw.json"
MAOGAI_RAW = ROOT / "scripts" / "bank" / "maogai_raw.json"
MAYUAN_OUT = ROOT / "data" / "mayuan.js"
MAOGAI_OUT = ROOT / "data" / "maogai.js"


def tidy(text):
    text = re.sub(r"\s+", " ", text or "").strip()
    text = text.replace("**", "")
    text = re.sub(r"^[（(]\s*[）)]\s*", "( )", text).strip()
    text = re.sub(r"^(?:\d{1,3}\s*[.．、]\s*)", "", text).strip()
    return text


def build_mayuan():
    chapters = json.loads(MAYUAN_RAW.read_text(encoding="utf-8"))
    out = []
    qid = 20000
    for chapter in chapters:
        answers = {int(k): v for k, v in chapter["ans_single"].items()}
        for item in chapter["single"]:
            qid += 1
            options = [{"key": k, "text": tidy(t)} for k, t in item["options"]]
            answer = answers[item["num"]]
            out.append({
                "id": qid,
                "chapter": chapter["name"],
                "type": "single",
                "typeText": "单选题",
                "score": 2,
                "question": tidy(item["stem"]),
                "options": options,
                "answer": answer,
                "explanation": "",
                "source": "2025版马原练习题",
            })
    return out


def build_maogai():
    docs = json.loads(MAOGAI_RAW.read_text(encoding="utf-8"))
    out = []
    qid = 30000
    for doc in docs:
        for item in doc["questions"]:
            qid += 1
            options = [{"key": k, "text": tidy(t)} for k, t in item["options"]]
            out.append({
                "id": qid,
                "chapter": doc["chapter"],
                "type": item["type"],
                "typeText": "单选题" if item["type"] == "single" else "多选题",
                "score": 2 if item["type"] == "single" else 4,
                "question": tidy(item["stem"]),
                "options": options,
                "answer": item["answer"],
                "explanation": tidy(item.get("explanation", "")),
                "source": "毛概学习通测试题",
            })
    return out


def dump(path, header, data):
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text("// %s\nmodule.exports = %s;\n" % (header, body), encoding="utf-8")
    return len(data)


def summary(rows):
    types = {}
    for r in rows:
        types[r["type"]] = types.get(r["type"], 0) + 1
    chapters = {}
    for r in rows:
        chapters[r["chapter"]] = chapters.get(r["chapter"], 0) + 1
    return types, chapters


if __name__ == "__main__":
    mayuan = build_mayuan()
    maogai = build_maogai()
    t1, c1 = summary(mayuan)
    t2, c2 = summary(maogai)
    print("mayuan", len(mayuan), t1)
    for k, v in c1.items():
        print("   ", k, v)
    print("maogai", len(maogai), t2)
    for k, v in c2.items():
        print("   ", k, v)
    dump(MAYUAN_OUT, "由 scripts/bank/build_bank.py 从《2025版马原练习题》自动生成，请勿手工改题。", mayuan)
    dump(MAOGAI_OUT, "由 scripts/bank/build_bank.py 从毛概学习通测试题自动生成，请勿手工改题。", maogai)
    print("ID_RANGE", mayuan[0]["id"], mayuan[-1]["id"], maogai[0]["id"], maogai[-1]["id"])
