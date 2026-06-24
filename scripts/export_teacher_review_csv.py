from __future__ import annotations

import argparse
import csv
from pathlib import Path

from normalize_questions import load_json


FIELDS = [
    "question_id",
    "subject",
    "topic",
    "question_text",
    "correct_answer",
    "ai_full_text",
    "teacher_full_text",
    "review_status",
    "reviewer",
    "reviewed_at",
    "note",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", default="data/questions_master.json")
    parser.add_argument("--cache", default="data/ai_tutor_cache.json")
    parser.add_argument("--output", default="data/teacher_review_template.csv")
    args = parser.parse_args()

    questions = load_json(Path(args.questions), [])
    cache = load_json(Path(args.cache), {})
    with Path(args.output).open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        for question in questions:
            item = cache.get(question.get("question_id", ""), {})
            writer.writerow({
                "question_id": question.get("question_id", ""),
                "subject": question.get("subject", ""),
                "topic": question.get("topic", ""),
                "question_text": question.get("question_text", ""),
                "correct_answer": question.get("correct_answer", ""),
                "ai_full_text": item.get("ai_full_text", ""),
                "teacher_full_text": "",
                "review_status": "unreviewed",
                "reviewer": "",
                "reviewed_at": "",
                "note": "",
            })
    print(f"teacher review csv -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
