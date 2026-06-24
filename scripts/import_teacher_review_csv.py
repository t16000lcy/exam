from __future__ import annotations

import argparse
import csv
from pathlib import Path

from normalize_questions import load_json, write_json


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="data/teacher_review_template.csv")
    parser.add_argument("--output", default="data/ai_tutor_reviewed.json")
    args = parser.parse_args()

    reviewed = load_json(Path(args.output), {})
    with Path(args.csv).open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            if row.get("review_status") != "reviewed":
                continue
            text = row.get("teacher_full_text") or row.get("ai_full_text")
            question_id = row.get("question_id", "")
            if not question_id or not text:
                continue
            reviewed[question_id] = {
                "question_id": question_id,
                "ai_version": "teacher",
                "review_status": "reviewed",
                "teacher_review_status": "reviewed",
                "ai_full_text": text,
                "generated_source": "teacher",
                "reviewer": row.get("reviewer", ""),
                "reviewed_at": row.get("reviewed_at", ""),
                "note": row.get("note", ""),
            }
    write_json(Path(args.output), reviewed)
    print(f"reviewed tutor json -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
