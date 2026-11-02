# -*- coding: utf-8 -*-
"""合并马原 / 毛概解析批次，校验覆盖率后写入小程序数据文件。"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25")
BATCH_DIR = ROOT / "scripts" / "bank" / "annotation-output-2"
MAYUAN_OUT = ROOT / "data" / "annotations-mayuan.js"
MAOGAI_OUT = ROOT / "data" / "annotations-maogai.js"

BANNED = ["与题意不符", "不符合题意", "显然错误", "多读几遍", "认真审题"]


def load_bank(name):
    text = (ROOT / "data" / name).read_text(encoding="utf-8")
    return json.loads(text.split("module.exports = ", 1)[1].rstrip().rstrip(";"))


def load_batches():
    merged = {}
    files = sorted(BATCH_DIR.glob("batch-*.json"))
    if not files:
        raise SystemExit("没有解析批次文件")
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        for key, value in data.items():
            if key in merged:
                raise SystemExit("重复题号: %s (%s)" % (key, path.name))
            merged[key] = value
    return merged, files


def check(bank, merged):
    errors = []
    for question in bank:
        key = str(question["id"])
        item = merged.get(key)
        if not item:
            errors.append("%s 缺少解析" % key)
            continue
        solution = (item.get("solution") or "").strip()
        tip = (item.get("memoryTip") or "").strip()
        analysis = item.get("optionAnalysis") or {}
        keys = [option["key"] for option in question["options"]]
        if not 40 <= len(solution) <= 160:
            errors.append("%s 解题思路长度 %d" % (key, len(solution)))
        if not 18 <= len(tip) <= 80:
            errors.append("%s 记忆小注长度 %d" % (key, len(tip)))
        if list(analysis.keys()) != keys:
            errors.append("%s 选项解析键不匹配 %s vs %s" % (key, list(analysis.keys()), keys))
        for key_option, text in analysis.items():
            if not 18 <= len(text or "") <= 120:
                errors.append("%s%s 选项解析长度 %d" % (key, key_option, len(text or "")))
        if not question["answer"]:
            errors.append("%s 标准答案为空" % key)
        for phrase in BANNED:
            if phrase in solution or phrase in tip:
                errors.append("%s 含空泛短语 %s" % (key, phrase))
    extra = set(merged) - {str(question["id"]) for question in bank}
    if extra:
        errors.append("多余题号: %s" % sorted(extra)[:10])
    return errors


def write_js(path, header, data):
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text("// %s\nmodule.exports = %s;\n" % (header, body), encoding="utf-8")


def main():
    mayuan = load_bank("mayuan.js")
    maogai = load_bank("maogai.js")
    merged, files = load_batches()
    print("批次文件", len(files), "解析条目", len(merged))
    errors = check(mayuan + maogai, merged)
    if errors:
        print("校验失败 %d 条：" % len(errors))
        for item in errors[:40]:
            print("  -", item)
        sys.exit(1)

    mayuan_part = {str(q["id"]): merged[str(q["id"])] for q in mayuan}
    maogai_part = {str(q["id"]): merged[str(q["id"])] for q in maogai}
    write_js(MAYUAN_OUT, "马原题目深度解析，由 scripts/bank/merge_annotations.py 生成。", mayuan_part)
    write_js(MAOGAI_OUT, "毛概题目深度解析，由 scripts/bank/merge_annotations.py 生成。", maogai_part)

    options = sum(len(v["optionAnalysis"]) for v in merged.values())
    tips = [v["memoryTip"] for v in merged.values()]
    print("马原", len(mayuan_part), "毛概", len(maogai_part), "选项解析", options, "记忆小注", len(tips), "去重", len(set(tips)))


if __name__ == "__main__":
    main()
