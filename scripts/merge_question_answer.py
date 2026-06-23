from __future__ import annotations

from collections import defaultdict

from common import (
    ANSWERS_RAW_DIR,
    DATA_QUESTIONS_DIR,
    QUESTIONS_RAW_DIR,
    SLUG_TO_SUBJECT,
    build_source_label,
    ensure_dirs,
    question_id,
    read_json,
    write_json,
)


def answer_key(answer_doc: dict, number: int) -> tuple[str, str, str, int]:
    return (answer_doc.get("year", ""), answer_doc.get("subject_slug", ""), answer_doc.get("exam_session", ""), number)


def main() -> int:
    ensure_dirs()
    questions = []
    for path in sorted(QUESTIONS_RAW_DIR.glob("*.json")):
        questions.extend(read_json(path, []))

    answers_by_key = {}
    answer_docs = []
    for path in sorted(ANSWERS_RAW_DIR.glob("*.json")):
        doc = read_json(path, {})
        answer_docs.append(doc)
        for item in doc.get("answers", []):
            number = int(item["question_number"])
            answers_by_key[answer_key(doc, number)] = item
            if doc.get("exam_code"):
                answers_by_key[(doc.get("year", ""), doc.get("exam_code", ""), doc.get("exam_session", ""), number)] = item

    question_keys: set[tuple[str, str, str, int]] = set()
    grouped: dict[str, list[dict]] = defaultdict(list)
    missing = 0
    for question in questions:
        number = int(question["question_number"])
        question_keys.add((question.get("year", ""), question.get("subject_slug", ""), question.get("exam_session", ""), number))
        item = answers_by_key.get((question.get("year", ""), question.get("subject_slug", ""), question.get("exam_session", ""), number))
        if not item:
            item = answers_by_key.get((question.get("year", ""), question.get("exam_code", ""), question.get("exam_session", ""), number))
        if item:
            question["answer_type"] = item["answer_type"]
            question["answer"] = item["answer"]
        else:
            question["answer_type"] = "single"
            question["answer"] = []
            missing += 1
        question["options"] = complete_options(question.get("options", []))
        if question["answer_type"] != "all_credit" and not question["answer"]:
            question["answer_type"] = "all_credit"
        grouped[question.get("subject_slug", "unknown")].append(question)

    for doc in answer_docs:
        slug = doc.get("subject_slug", "unknown")
        if slug == "unknown":
            continue
        for answer in doc.get("answers", []):
            number = int(answer["question_number"])
            key = (doc.get("year", ""), slug, doc.get("exam_session", ""), number)
            if key in question_keys:
                continue
            answer_type = answer["answer_type"]
            answer_values = answer["answer"]
            if answer_type != "all_credit" and not answer_values:
                answer_type = "all_credit"
            grouped[slug].append(
                {
                    "id": question_id(doc.get("year", ""), doc.get("exam_session", ""), slug, number),
                    "year": doc.get("year", ""),
                    "exam_code": doc.get("exam_session", ""),
                    "exam_session": doc.get("exam_session", ""),
                    "source_label": build_source_label(doc.get("year", ""), doc.get("exam_session", ""), doc.get("subject", ""), number),
                    "subject": doc.get("subject", ""),
                    "subject_slug": slug,
                    "question_number": number,
                    "stem": "此題 PDF 文字擷取失敗，請參考原始試題 PDF。",
                    "options": complete_options([]),
                    "has_image": False,
                    "image_paths": [],
                    "answer_type": answer_type,
                    "answer": answer_values,
                    "source_pdf": doc.get("source_pdf", ""),
                    "parse_warning": "question_text_missing",
                }
            )
            question_keys.add(key)

    for slug, subject in SLUG_TO_SUBJECT.items():
        items = sorted(grouped.get(slug, []), key=lambda item: (item.get("year", ""), item.get("exam_code", ""), item["question_number"]))
        for item in items:
            item["subject"] = item.get("subject") or subject
            item["subject_slug"] = slug
        write_json(DATA_QUESTIONS_DIR / f"{slug}.json", items)
        print(f"{slug}: {len(items)} questions")

    if "unknown" in grouped:
        write_json(DATA_QUESTIONS_DIR / "unknown.json", grouped["unknown"])
        print(f"unknown: {len(grouped['unknown'])} questions")

    if missing:
        print(f"警告：{missing} 題缺少答案，請查看 validate_question_bank.py 報告。")
    return 0


def complete_options(options: list[dict]) -> list[dict]:
    by_label = {option.get("label"): option for option in options if option.get("label") in {"A", "B", "C", "D"}}
    completed = []
    for label in ["A", "B", "C", "D"]:
        option = by_label.get(label)
        if option and option.get("text"):
            completed.append({"label": label, "text": option["text"]})
        else:
            completed.append({"label": label, "text": f"選項 {label}（PDF 文字未擷取）"})
    return completed


if __name__ == "__main__":
    raise SystemExit(main())
