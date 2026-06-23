from __future__ import annotations

from collections import defaultdict

from common import DATA_QUESTIONS_DIR, SLUG_TO_SUBJECT, ensure_dirs, read_json, write_json


def validate_subject(slug: str, questions: list[dict]) -> dict:
    issues = []
    by_year_exam: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for question in questions:
        by_year_exam[(question.get("year", ""), question.get("exam_code", ""))].append(question)
        option_labels = {option.get("label") for option in question.get("options", [])}
        if option_labels != {"A", "B", "C", "D"}:
            issues.append({"type": "missing_options", "question_id": question.get("id"), "labels": sorted(option_labels)})
        if question.get("answer_type") != "all_credit" and not question.get("answer"):
            issues.append({"type": "missing_answer", "question_id": question.get("id")})

    year_reports = []
    for (year, exam_code), items in sorted(by_year_exam.items()):
        numbers = sorted(int(item["question_number"]) for item in items)
        expected = list(range(1, 81))
        missing_numbers = [number for number in expected if number not in numbers]
        duplicate_numbers = sorted({number for number in numbers if numbers.count(number) > 1})
        if len(items) != 80:
            issues.append({"type": "year_exam_count_not_80", "year": year, "exam_code": exam_code, "count": len(items)})
        if missing_numbers or duplicate_numbers:
            issues.append(
                {
                    "type": "question_numbers_not_continuous",
                    "year": year,
                    "exam_code": exam_code,
                    "missing": missing_numbers,
                    "duplicates": duplicate_numbers,
                }
            )
        year_reports.append({"year": year, "exam_code": exam_code, "count": len(items)})

    return {
        "subject_slug": slug,
        "subject": SLUG_TO_SUBJECT.get(slug, slug),
        "total_questions": len(questions),
        "year_exams": year_reports,
        "issues": issues,
    }


def main() -> int:
    ensure_dirs()
    report = {"subjects": [], "ok": True}
    for slug in SLUG_TO_SUBJECT:
        questions = read_json(DATA_QUESTIONS_DIR / f"{slug}.json", [])
        subject_report = validate_subject(slug, questions)
        if subject_report["issues"]:
            report["ok"] = False
        report["subjects"].append(subject_report)

    write_json(DATA_QUESTIONS_DIR.parent / "parse_report.json", report)
    print(f"parse_report.json generated. ok={report['ok']}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
