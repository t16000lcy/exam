from __future__ import annotations

import argparse
from pathlib import Path

from normalize_questions import load_json, write_json


REQUIRED_FIELDS = [
    "core_concept",
    "correct_answer_text",
    "why_correct",
    "memory_sentence",
    "practice_question",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", default="data/questions_master.json")
    parser.add_argument("--input", default="data/ai_tutor_cache.json")
    parser.add_argument("--output", default="data/validation_report.json")
    args = parser.parse_args()

    questions = load_json(Path(args.questions), [])
    cache = load_json(Path(args.input), {})
    issues: list[dict] = []
    question_ids = [item.get("question_id", "") for item in questions]

    for question in questions:
        question_id = question.get("question_id", "")
        item = cache.get(question_id)
        if not item:
            issues.append({"type": "missing_ai_tutor", "question_id": question_id})
            continue
        for field in REQUIRED_FIELDS:
            if not item.get(field):
                issues.append({"type": "missing_ai_field", "question_id": question_id, "field": field})
        option_analysis = item.get("option_analysis") or {}
        for label in ["A", "B", "C", "D"]:
            if not option_analysis.get(label):
                issues.append({"type": "missing_option_analysis", "question_id": question_id, "option": label})
        warnings = item.get("warnings") or []
        if question.get("requires_image") and "本題需搭配原圖判讀" not in warnings:
            issues.append({"type": "missing_image_warning", "question_id": question_id})
        if question.get("is_all_correct") and "官方答案為一律給分，不列入錯題統計" not in warnings:
            issues.append({"type": "missing_all_correct_warning", "question_id": question_id})
        if "ai_full_text" not in item:
            issues.append({"type": "missing_ai_full_text_key", "question_id": question_id})

    extra_ids = sorted(set(cache) - set(question_ids))
    report = {
        "ok": not issues,
        "total_questions": len(questions),
        "ai_tutor_items": len(cache),
        "complete_ai_full_text_count": sum(1 for item in cache.values() if item.get("generated_source") == "ai" and item.get("ai_full_text")),
        "template_count": sum(1 for item in cache.values() if item.get("generated_source") != "ai"),
        "issues": issues,
        "extra_cache_ids": extra_ids[:100],
        "extra_cache_count": len(extra_ids),
    }
    write_json(Path(args.output), report)
    print(f"validated ai tutor cache. ok={report['ok']} issues={len(issues)}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
