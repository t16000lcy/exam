from __future__ import annotations

import argparse
import csv
from pathlib import Path

from normalize_questions import load_json, write_json


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="data/teacher_review_template.csv")
    parser.add_argument("--cache", default="data/ai_tutor_cache.json")
    args = parser.parse_args()

    cache_path = Path(args.cache)
    cache = load_json(cache_path, {})
    with Path(args.csv).open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            if row.get("review_status") != "reviewed":
                continue
            question_id = row.get("question_id", "")
            if not question_id:
                continue
            item = cache.get(question_id, {})
            item.update({
                "question_id": question_id,
                "core_concept": row.get("teacher_core_concept") or row.get("ai_core_concept", ""),
                "why_correct": row.get("teacher_why_correct") or row.get("ai_why_correct", ""),
                "option_analysis": {
                    "A": row.get("teacher_option_A") or row.get("ai_option_A", ""),
                    "B": row.get("teacher_option_B") or row.get("ai_option_B", ""),
                    "C": row.get("teacher_option_C") or row.get("ai_option_C", ""),
                    "D": row.get("teacher_option_D") or row.get("ai_option_D", ""),
                },
                "memory_sentence": row.get("teacher_memory_sentence") or row.get("ai_memory_sentence", ""),
                "practice_question": row.get("teacher_practice_question") or row.get("ai_practice_question", ""),
                "teacher_review_status": "reviewed",
                "reviewer": row.get("reviewer", ""),
                "reviewed_at": row.get("reviewed_at", ""),
            })
            cache[question_id] = item
    write_json(cache_path, cache)
    print(f"imported teacher review -> {cache_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
