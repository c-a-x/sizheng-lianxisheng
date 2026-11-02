import json
import re
import sys
from collections import Counter
from pathlib import Path

TYPE_MAP = {
    "single_choice": "single",
    "multiple_choice": "multiple",
    "judgment": "judge",
}

TYPE_TEXT = {
    "single": "单选题",
    "multiple": "多选题",
    "judge": "判断题",
}


def extract(source: Path):
    html = source.read_text(encoding="utf-8")
    match = re.search(r"const\s+allQuestionsData\s*=\s*(\[.*?\])\s*;", html, re.S)
    if not match:
        raise ValueError("未找到 allQuestionsData 题库数组")
    array_text = re.sub(r"^\s*//.*$", "", match.group(1), flags=re.M)
    raw_questions = json.loads(array_text)
    questions = []
    seen_ids = set()

    for raw in raw_questions:
        question_id = raw["id"]
        if question_id in seen_ids:
            raise ValueError(f"题目 ID 重复: {question_id}")
        seen_ids.add(question_id)

        question_type = TYPE_MAP.get(raw["type"])
        if not question_type:
            raise ValueError(f"不支持的题型: {raw['type']}")

        options = [
            {"key": key, "text": str(text)}
            for key, text in raw["options"].items()
        ]
        option_keys = {option["key"] for option in options}
        correct_answer = raw["correct_answer"]
        answer = correct_answer if isinstance(correct_answer, list) else [correct_answer]
        answer = [str(key) for key in answer]
        if not answer or any(key not in option_keys for key in answer):
            raise ValueError(f"题目 {question_id} 的答案与选项不匹配")
        if not raw.get("explanation"):
            raise ValueError(f"题目 {question_id} 缺少解析")

        questions.append({
            "id": question_id,
            "chapter": raw["chapter"],
            "type": question_type,
            "typeText": TYPE_TEXT[question_type],
            "score": raw.get("score", 0),
            "question": raw["question"],
            "options": options,
            "answer": answer,
            "explanation": raw["explanation"],
        })

    return questions


def main():
    if len(sys.argv) != 3:
        raise SystemExit("用法: python extract_questions.py <源HTML> <输出JS>")
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    questions = extract(source)
    payload = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    output.write_text(
        "// 由 scripts/extract_questions.py 从用户提供的 HTML 自动生成，请勿手工改题。\n"
        f"module.exports = {payload};\n",
        encoding="utf-8",
    )
    chapters = Counter(question["chapter"] for question in questions)
    types = Counter(question["type"] for question in questions)
    print(json.dumps({
        "total": len(questions),
        "types": types,
        "chapters": chapters,
        "outputBytes": output.stat().st_size,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
