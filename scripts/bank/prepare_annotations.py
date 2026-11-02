# -*- coding: utf-8 -*-
"""把马原 / 毛概题目切成解析生成批次。"""

import json
import pathlib
import math

ROOT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25")
OUT_DIR = ROOT / "scripts" / "bank" / "annotation-batches"
BATCH_SIZE = 50


def load(path):
    text = path.read_text(encoding="utf-8")
    body = text.split("module.exports = ", 1)[1].rstrip().rstrip(";")
    return json.loads(body)


def pack(rows):
    return {
        str(row["id"]): {
            "type": row["type"],
            "chapter": row["chapter"],
            "question": row["question"],
            "options": [{"key": option["key"], "text": option["text"]} for option in row["options"]],
            "answer": row["answer"],
        }
        for row in rows
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("batch-*.json"):
        old.unlink()
    source = load(ROOT / "data" / "mayuan.js") + load(ROOT / "data" / "maogai.js")
    total = len(source)
    count = math.ceil(total / BATCH_SIZE)
    manifest = []
    for index in range(count):
        chunk = source[index * BATCH_SIZE:(index + 1) * BATCH_SIZE]
        batch = pack(chunk)
        path = OUT_DIR / ("batch-%02d.json" % (index + 1))
        path.write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")
        manifest.append({
            "file": path.name,
            "count": len(chunk),
            "first": str(chunk[0]["id"]),
            "last": str(chunk[-1]["id"]),
        })
    print("TOTAL", total, "BATCHES", count)
    for item in manifest:
        print(item["file"], item["count"], item["first"], "-", item["last"])


if __name__ == "__main__":
    main()
