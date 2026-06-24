from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from normalize_questions import load_json, write_json


VALID_ANSWERS = {"A", "B", "C", "D", "ALL"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/questions_master.json")
    parser.add_argument("--output", default="data/validation_report.json")
    args = parser.parse_args()

    questions = load_json(Path(args.input), [])
    issues: list[dict] = []
    image_questions: list[dict] = []
    all_correct_questions: list[dict] = []
    missing_answers: list[dict] = []
    manual_review_questions: list[dict] = []

    ids = [str(question.get("question_id") or "") for question in questions]
    duplicate_ids = sorted(question_id for question_id, count in Counter(ids).items() if question_id and count > 1)
    for question_id in duplicate_ids:
        issues.append({"type": "duplicate_question_id", "question_id": question_id})

    for question in questions:
        question_id = str(question.get("question_id") or "")
        options = question.get("options") or {}
        if not question_id:
            issues.append({"type": "missing_question_id", "question_no": question.get("question_no")})

        if not isinstance(options, dict):
            issues.append({"type": "invalid_options_shape", "question_id": question_id})
            options = {}
        missing_option_labels = [label for label in ["A", "B", "C", "D"] if not str(options.get(label, "")).strip()]
        if missing_option_labels:
            issues.append({"type": "missing_options", "question_id": question_id, "labels": missing_option_labels})

        answer = str(question.get("correct_answer") or "").replace(" ", "")
        if question.get("is_all_correct"):
            all_correct_questions.append(summary(question))
            if answer != "ALL":
                issues.append({"type": "all_correct_answer_not_all", "question_id": question_id, "correct_answer": answer})
        elif not answer:
            item = summary(question)
            missing_answers.append(item)
            issues.append({"type": "missing_answer", "question_id": question_id})
        else:
            answer_parts = [part for part in answer.split("或") if part]
            if not answer_parts or any(part not in VALID_ANSWERS - {"ALL"} for part in answer_parts):
                issues.append({"type": "invalid_answer", "question_id": question_id, "correct_answer": answer})

        if question.get("requires_image") or question.get("image_paths"):
            image_questions.append(summary(question))
            manual_review_questions.append({"reason": "image_question", **summary(question)})
        if question.get("topic") == "待分類":
            manual_review_questions.append({"reason": "topic_pending", **summary(question)})
        if question.get("is_all_correct"):
            manual_review_questions.append({"reason": "all_correct", **summary(question)})

    report = {
        "ok": not issues,
        "total_questions": len(questions),
        "unique_question_ids": len(set(ids)),
        "duplicate_question_ids": duplicate_ids,
        "image_question_count": len(image_questions),
        "missing_answer_count": len(missing_answers),
        "all_correct_count": len(all_correct_questions),
        "manual_review_count": len(manual_review_questions),
        "issues": issues,
        "image_questions": image_questions,
        "missing_answers": missing_answers,
        "all_correct_questions": all_correct_questions,
        "manual_review_questions": manual_review_questions,
    }
    write_json(Path(args.output), report)
    print(f"validated question bank. ok={report['ok']} questions={len(questions)} issues={len(issues)}")
    return 0 if report["ok"] else 1


def summary(question: dict) -> dict:
    return {
        "question_id": question.get("question_id", ""),
        "year": question.get("year", ""),
        "exam_round": question.get("exam_round", ""),
        "subject": question.get("subject", ""),
        "question_no": question.get("question_no", 0),
        "topic": question.get("topic", ""),
    }


if __name__ == "__main__":
    raise SystemExit(main())
