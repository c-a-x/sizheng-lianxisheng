import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTION_FILE = ROOT / "data" / "questions.js"
BATCH_DIR = ROOT / "scripts" / "annotation-batches"
OUTPUT_DIR = ROOT / "scripts" / "annotation-output"
MERGED_FILE = ROOT / "data" / "annotations.js"
BATCH_SIZE = 49

FORBIDDEN = (
    "不符合题意",
    "与题意不符",
    "多读几遍",
    "认真审题",
    "记住即可",
    "暂无解析",
    "略",
    "同上",
    "模型生成",
)


def load_questions():
    text = QUESTION_FILE.read_text(encoding="utf-8")
    payload = text.split("module.exports = ", 1)[1].strip().rstrip(";")
    return json.loads(payload)


def prepare():
    questions = load_questions()
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index in range(0, len(questions), BATCH_SIZE):
        batch_number = index // BATCH_SIZE + 1
        batch = questions[index:index + BATCH_SIZE]
        output = BATCH_DIR / f"batch-{batch_number:02d}.json"
        output.write_text(json.dumps(batch, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{output.name}: {batch[0]['id']} - {batch[-1]['id']} ({len(batch)} 题)")


def compact_length(value):
    return len(re.sub(r"\s+", "", value or ""))


def merge():
    questions = load_questions()
    by_id = {str(question["id"]): question for question in questions}
    annotation_map = {}
    errors = []
    files = sorted(OUTPUT_DIR.glob("batch-*.json"))
    if len(files) != 8:
        raise SystemExit(f"应收到 8 个批次文件，实际 {len(files)} 个")

    for file in files:
        try:
            batch_annotations = json.loads(file.read_text(encoding="utf-8"))
        except Exception as error:
            errors.append(f"{file.name}: JSON 无法解析 ({error})")
            continue
        if not isinstance(batch_annotations, dict):
            errors.append(f"{file.name}: 顶层必须是对象")
            continue
        for question_id, annotation in batch_annotations.items():
            if question_id in annotation_map:
                errors.append(f"{question_id}: 题号重复")
                continue
            annotation_map[question_id] = annotation

    missing_ids = sorted(set(by_id) - set(annotation_map), key=int)
    extra_ids = sorted(set(annotation_map) - set(by_id), key=int)
    if missing_ids:
        errors.append(f"缺少题号: {', '.join(missing_ids)}")
    if extra_ids:
        errors.append(f"多余题号: {', '.join(extra_ids)}")

    tips = []
    phrase_counter = Counter()
    option_total = 0
    review_flags = []
    for question_id, question in by_id.items():
        annotation = annotation_map.get(question_id)
        if not annotation:
            continue
        solution = annotation.get("solution", "").strip()
        option_analysis = annotation.get("optionAnalysis") or {}
        tip = annotation.get("memoryTip", "").strip()
        expected_keys = [option["key"] for option in question["options"]]

        if not 30 <= compact_length(solution) <= 180:
            errors.append(f"{question_id}: 解题思路长度不合适 ({compact_length(solution)})")
        if solution == question["explanation"].strip():
            errors.append(f"{question_id}: 解题思路照抄原解析")
        if list(option_analysis.keys()) != expected_keys:
            errors.append(f"{question_id}: 选项键应为 {expected_keys}，实际 {list(option_analysis.keys())}")
        for key, text in option_analysis.items():
            text = (text or "").strip()
            option_total += 1
            if not 16 <= compact_length(text) <= 150:
                errors.append(f"{question_id}{key}: 选项解析长度不合适 ({compact_length(text)})")
            for phrase in FORBIDDEN:
                if text == phrase or (len(phrase) >= 4 and phrase in text):
                    errors.append(f"{question_id}{key}: 含空泛短语“{phrase}”")
        if not 12 <= compact_length(tip) <= 110:
            errors.append(f"{question_id}: 记忆小注长度不合适 ({compact_length(tip)})")
        for phrase in FORBIDDEN:
            if tip == phrase or (len(phrase) >= 4 and phrase in tip):
                errors.append(f"{question_id}: 记忆小注含空泛短语“{phrase}”")
        tips.append(tip)
        if tip:
            phrase_counter[tip] += 1
        if annotation.get("reviewFlag"):
            review_flags.append(f"{question_id}: {annotation['reviewFlag']}")

    duplicate_tips = [tip for tip, count in phrase_counter.items() if count > 1]
    if duplicate_tips:
        errors.append(f"重复记忆小注 {len(duplicate_tips)} 条，例如：{duplicate_tips[0]}")

    if errors:
        print(f"校验失败，共 {len(errors)} 项：")
        for error in errors[:120]:
            print("-", error)
        raise SystemExit(1)

    ordered = {question_id: annotation_map[question_id] for question_id in by_id}
    payload = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    MERGED_FILE.write_text(
        "// 392 题逐题解题思路、选项解析与记忆小注。\n"
        f"module.exports = {payload};\n",
        encoding="utf-8",
    )
    audit = {
        "questions": len(ordered),
        "options": option_total,
        "memoryTips": len(tips),
        "uniqueMemoryTips": len(set(tips)),
        "reviewFlags": review_flags,
        "mergedBytes": MERGED_FILE.stat().st_size,
    }
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "prepare":
        prepare()
    elif len(sys.argv) == 2 and sys.argv[1] == "merge":
        merge()
    else:
        raise SystemExit("用法: python scripts/merge_annotations.py prepare|merge")
