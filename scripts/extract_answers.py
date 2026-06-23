from __future__ import annotations

import argparse
import re
from pathlib import Path

from common import (
    ANSWERS_RAW_DIR,
    PDF_DIR,
    clean_text,
    ensure_dirs,
    infer_exam_code,
    infer_exam_session,
    infer_filename_metadata,
    infer_subject,
    infer_year,
    looks_like_answer_pdf,
    pdf_text,
    write_json,
)

ANSWER_LETTERS = set("ABCD")
FULLWIDTH_MAP = str.maketrans("ＡＢＣＤ＃", "ABCD#")


def normalize_answer_token(token: str) -> list[str]:
    token = token.translate(FULLWIDTH_MAP).upper().replace(" ", "")
    token = token.replace("或", "/").replace("、", "/").replace(",", "/").replace("，", "/")
    if "/" in token:
        return [part for part in token.split("/") if part in ANSWER_LETTERS]
    if len(token) > 1 and all(char in ANSWER_LETTERS for char in token):
        return list(token)
    return [token] if token in ANSWER_LETTERS else []


def parse_answer_rows(text: str) -> dict[int, dict]:
    answers: dict[int, dict] = {}
    normalized = clean_text(text).translate(FULLWIDTH_MAP)
    patterns = [
        re.compile(r"(?P<number>[1-8]?\d)\s*[\.\、．:：]\s*(?P<answer>[ABCD](?:\s*(?:或|/|、|,|，)?\s*[ABCD])*)", re.I),
        re.compile(r"第\s*(?P<number>[1-8]?\d)\s*題\s*(?:答案)?\s*(?P<answer>[ABCD](?:\s*(?:或|/|、|,|，)?\s*[ABCD])*)", re.I),
    ]
    for pattern in patterns:
        for match in pattern.finditer(normalized):
            number = int(match.group("number"))
            if not 1 <= number <= 80:
                continue
            values = normalize_answer_token(match.group("answer"))
            if values:
                answers[number] = {"answer_type": "single" if len(values) == 1 else "multiple_accepted", "answer": values}
    if len(answers) < 40:
        table_answers = parse_standard_answer_table(normalized)
        if table_answers:
            answers.update(table_answers)
    return answers


def parse_standard_answer_table(text: str) -> dict[int, dict]:
    end_match = re.search(r"\n\s*備", text)
    chunk = text[: end_match.start() if end_match else len(text)]
    lines = [line.strip() for line in chunk.splitlines() if line.strip()]
    letters: list[str] = []
    collecting = False
    seen_table = False
    for line in lines:
        line = line.translate(FULLWIDTH_MAP)
        if "題號" in line or "題序" in line:
            seen_table = True
            collecting = False
            continue
        if not seen_table:
            continue
        if "答案" in line:
            collecting = True
            suffix = line.split("答案", 1)[1]
            letters.extend(re.findall(r"(?<![A-Z])[ABCD#](?![A-Z])", suffix))
            continue
        if collecting:
            letters.extend(re.findall(r"(?<![A-Z])[ABCD#](?![A-Z])", line))
    if len(letters) < 80:
        return {}
    return {
        number: {"answer_type": "single", "answer": [] if answer == "#" else [answer]}
        for number, answer in enumerate(letters[:80], start=1)
    }


def apply_corrections(text: str, answers: dict[int, dict]) -> None:
    normalized = clean_text(text).translate(FULLWIDTH_MAP)
    for match in re.finditer(r"第\s*(?P<number>[1-8]?\d)\s*題[^。\n]*(?:一律給分|均給分|送分)", normalized):
        number = int(match.group("number"))
        answers[number] = {"answer_type": "all_credit", "answer": []}

    accepted_pattern = re.compile(
        r"第\s*(?P<number>[1-8]?\d)\s*題[^。\n]*答\s*(?P<answers>[ABCD](?:\s*(?:或|/|、|,|，)?\s*[ABCD])*)\s*者?[^。\n]*(?:均給分|皆給分|給分)",
        re.I,
    )
    for match in accepted_pattern.finditer(normalized):
        number = int(match.group("number"))
        values = normalize_answer_token(match.group("answers"))
        if values:
            answers[number] = {"answer_type": "multiple_accepted", "answer": values}

    correction_pattern = re.compile(
        r"第\s*(?P<number>[1-8]?\d)\s*題[^。\n]*(?:更正答案|答案更正|更正為|改為)\s*(?P<answer>[ABCD](?:\s*(?:或|/|、|,|，)?\s*[ABCD])*)",
        re.I,
    )
    for match in correction_pattern.finditer(normalized):
        number = int(match.group("number"))
        values = normalize_answer_token(match.group("answer"))
        if values:
            answers[number] = {"answer_type": "single" if len(values) == 1 else "multiple_accepted", "answer": values}


def parse_pdf(pdf_path: Path) -> dict | None:
    text = "\n".join(pdf_text(pdf_path))
    if not looks_like_answer_pdf(pdf_path, text):
        return None
    filename_meta = infer_filename_metadata(pdf_path)
    year = infer_year(text, filename_meta["year"])
    exam_session = infer_exam_session(text, filename_meta["exam_session"])
    exam_code = infer_exam_code(text, exam_session or pdf_path.stem)
    subject, subject_slug = infer_subject(text, filename_meta["subject"])
    answers = parse_answer_rows(text)
    apply_corrections(text, answers)
    return {
        "source_pdf": str(pdf_path.relative_to(PDF_DIR)).replace("\\", "/"),
        "year": year,
        "exam_code": exam_code,
        "exam_session": exam_session,
        "subject": subject,
        "subject_slug": subject_slug,
        "answers": [
            {
                "question_number": number,
                "answer_type": item["answer_type"],
                "answer": item["answer"],
            }
            for number, item in sorted(answers.items())
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract answers from answer PDFs.")
    parser.add_argument("--pdf-dir", default=str(PDF_DIR))
    args = parser.parse_args()
    ensure_dirs()
    pdfs = sorted(Path(args.pdf_dir).rglob("*.pdf"))
    total = 0
    for pdf_path in pdfs:
        parsed = parse_pdf(pdf_path)
        if not parsed:
            continue
        output = ANSWERS_RAW_DIR / f"{pdf_path.parent.name}_{pdf_path.stem}.json"
        write_json(output, parsed)
        total += len(parsed["answers"])
        print(f"{pdf_path}: {len(parsed['answers'])} answers")
    if total == 0:
        print("未找到答案 PDF，請確認檔名或內容包含「答案」。")
        return 1
    print(f"完成擷取 {total} 答案。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
