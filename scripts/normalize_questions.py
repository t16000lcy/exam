from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def infer_topic(question: dict, rules: list[dict]) -> str:
    if question.get("topic"):
        return question["topic"]
    haystack = " ".join(
        str(value or "")
        for value in [
            question.get("stem"),
            question.get("question_text"),
            question.get("subject"),
            *[option.get("text", "") for option in question.get("options", [])],
        ]
    ).lower()
    for rule in rules:
        if any(keyword.lower() in haystack for keyword in rule.get("keywords", [])):
            return rule.get("topic", "待分類")
    return "待分類"


def normalize_question(question: dict, rules: list[dict]) -> dict:
    labels = {option.get("label"): option.get("text", "") for option in question.get("options", [])}
    answer = question.get("answer") or []
    is_all_correct = question.get("answer_type") == "all_credit" or question.get("is_all_correct") is True
    normalized = dict(question)
    normalized.setdefault("question_id", question.get("id", ""))
    normalized.setdefault("exam_round", "第一次" if str(question.get("exam_code", "")) == "1" else "第二次" if str(question.get("exam_code", "")) == "2" else "")
    normalized.setdefault("subject_code", "")
    normalized.setdefault("question_no", question.get("question_number", 0))
    normalized.setdefault("question_text", question.get("stem", ""))
    normalized.setdefault("correct_answer", "ALL" if is_all_correct else " 或 ".join(answer))
    normalized.setdefault("corrected_answer", "")
    normalized["is_all_correct"] = is_all_correct
    normalized.setdefault("requires_image", bool(question.get("has_image")))
    normalized["topic"] = infer_topic(question, rules)
    normalized.setdefault("subtopic", "")
    normalized.setdefault("difficulty", "")
    normalized.setdefault("common_mistake", "")
    normalized.setdefault("reference_note", "")
    normalized.setdefault("explanation_verified", "")
    normalized.setdefault("explanation_ai_draft", "")
    normalized.setdefault("ai_tutor", {
        "core_concept": "",
        "correct_answer_text": "",
        "why_correct": "本題需搭配原圖判讀。" if normalized["requires_image"] else "",
        "option_analysis": {"A": "", "B": "", "C": "", "D": ""},
        "memory_sentence": "",
        "practice_question": "",
        "practice_options": {"A": "", "B": "", "C": "", "D": ""},
        "practice_answer": "",
        "teacher_review_status": "unreviewed",
    })
    normalized.setdefault("source", {"question_pdf": question.get("source_pdf", ""), "answer_pdf": "", "page": None})
    normalized["standard_options"] = {label: labels.get(label, "") for label in ["A", "B", "C", "D"]}
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/questions_master.json")
    parser.add_argument("--output", default="data/questions_master.json")
    parser.add_argument("--rules", default="data/topic_rules.json")
    args = parser.parse_args()

    input_path = Path(args.input)
    rules = load_json(Path(args.rules), [])
    if input_path.exists():
      questions = load_json(input_path, [])
    else:
      questions = []
      for path in sorted(Path("data/questions").glob("*.json")):
          questions.extend(load_json(path, []))

    normalized = [normalize_question(question, rules) for question in questions]
    write_json(Path(args.output), normalized)
    print(f"normalized {len(normalized)} questions -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
