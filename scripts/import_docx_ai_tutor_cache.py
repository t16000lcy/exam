from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


SUBJECT_SLUGS = {
    "臨床生理學與病理學": "clinical-physiology-pathology",
    "臨床血液學與血庫學": "hematology-blood-bank",
    "醫學分子檢驗學與臨床鏡檢學": "molecular-microscopy-parasitology",
    "微生物學與臨床微生物學": "microbiology-clinical-microbiology",
    "生物化學與臨床生化學": "biochemistry-clinical-biochemistry",
    "臨床血清免疫學與臨床病毒學": "serology-immunology-virology",
}

ROUND_TO_CODE = {"第一次": "1", "第二次": "2"}
HEADING_RE = re.compile(r"(?P<year>\d{3})\s*年\s*(?P<round>第一次|第二次)")
QUESTION_RE = re.compile(r"^第\s*(?P<number>\d{1,2})\s*題$")


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def docx_paragraphs(path: Path) -> list[str]:
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs: list[str] = []
    for para in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in para.findall(".//w:t", ns)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def subject_slug_from_name(name: str) -> str | None:
    for subject, slug in SUBJECT_SLUGS.items():
        if subject in name:
            return slug
    return None


def load_question_index(data_dir: Path) -> dict[tuple[str, str, str, int], dict]:
    index: dict[tuple[str, str, str, int], dict] = {}
    for path in sorted((data_dir / "questions").glob("*.json")):
        questions = read_json(path, [])
        for question in questions:
            key = (
                str(question.get("year", "")),
                str(question.get("exam_code", "")),
                str(question.get("subject_slug", "")),
                int(question.get("question_number") or 0),
            )
            index[key] = question
    return index


def parse_docx(path: Path) -> list[dict]:
    subject_slug = subject_slug_from_name(path.name)
    if not subject_slug:
        return []

    paragraphs = docx_paragraphs(path)
    current_year = ""
    current_exam_code = ""
    in_questions = False
    current_number: int | None = None
    current_lines: list[str] = []
    items: list[dict] = []

    def flush() -> None:
        nonlocal current_number, current_lines
        if current_year and current_exam_code and current_number and current_lines:
            items.append(
                {
                    "year": current_year,
                    "exam_code": current_exam_code,
                    "subject_slug": subject_slug,
                    "question_number": current_number,
                    "lines": current_lines[:],
                    "source_docx": str(path),
                }
            )
        current_number = None
        current_lines = []

    for line in paragraphs:
        heading = HEADING_RE.search(line)
        if heading and ("國考題解題" in line or " - " in line or "－" in line):
            flush()
            current_year = heading.group("year")
            current_exam_code = ROUND_TO_CODE[heading.group("round")]
            in_questions = False
            continue

        if line == "逐題解題":
            flush()
            in_questions = True
            continue

        question_match = QUESTION_RE.match(line)
        if question_match and in_questions:
            flush()
            current_number = int(question_match.group("number"))
            current_lines = [line]
            continue

        if current_number and in_questions:
            if line.startswith("——"):
                continue
            current_lines.append(line)

    flush()
    return items


def extract_after_heading(lines: list[str], heading: str) -> str:
    prefix = f"【{heading}】"
    for idx, line in enumerate(lines):
        if line.startswith(prefix):
            text = line[len(prefix) :].strip()
            if text:
                return text
            if idx + 1 < len(lines):
                return lines[idx + 1].strip()
    return ""


def extract_option_analysis(lines: list[str]) -> dict[str, str]:
    result = {"A": "", "B": "", "C": "", "D": ""}
    in_options = False
    for line in lines:
        if line.startswith("【選項解析】"):
            in_options = True
            continue
        if in_options and line.startswith("【"):
            break
        if in_options:
            match = re.match(r"^([ABCD])[:：]\s*(.*)$", line)
            if match:
                result[match.group(1)] = match.group(2).strip()
    return result


def build_tutor_item(raw: dict, question: dict | None) -> dict:
    lines = raw["lines"]
    explanation_start = next((idx for idx, line in enumerate(lines) if line.startswith("【本題考點】")), 0)
    ai_full_text = "\n".join(lines[explanation_start:]).strip()
    option_analysis = extract_option_analysis(lines)
    correct_answer = extract_after_heading(lines, "正確答案")
    warnings: list[str] = []
    if question and (question.get("has_image") or question.get("requires_image") or question.get("image_paths")):
        warnings.append("本題需搭配原圖判讀")
    if question and question.get("answer_type") == "all_credit":
        warnings.append("官方答案為一律給分，不列入錯題統計")

    return {
        "question_id": question.get("id") if question else "",
        "ai_version": "docx-v1",
        "review_status": "unreviewed",
        "core_concept": extract_after_heading(lines, "本題考點"),
        "correct_answer_text": correct_answer,
        "why_correct": extract_after_heading(lines, "為什麼是這個答案"),
        "option_analysis": option_analysis,
        "memory_sentence": extract_after_heading(lines, "考前記憶句"),
        "practice_question": extract_after_heading(lines, "再練習"),
        "practice_options": {"A": "", "B": "", "C": "", "D": ""},
        "practice_answer": "",
        "ai_full_text": ai_full_text,
        "warnings": warnings,
        "teacher_review_status": "unreviewed",
        "needs_teacher_check": bool(warnings),
        "generated_source": "docx",
        "source_docx": raw["source_docx"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Folder containing yearly Word explanation folders.")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--report", default="data/ai_tutor_import_report.json")
    args = parser.parse_args()

    input_dir = Path(args.input)
    data_dir = Path(args.data_dir)
    question_index = load_question_index(data_dir)
    cache: dict[str, dict] = {}
    unmatched: list[dict] = []
    parsed_count = 0
    docx_files = sorted(input_dir.rglob("*.docx"))

    for docx in docx_files:
        for raw in parse_docx(docx):
            parsed_count += 1
            key = (raw["year"], raw["exam_code"], raw["subject_slug"], raw["question_number"])
            question = question_index.get(key)
            if not question:
                unmatched.append(
                    {
                        "year": raw["year"],
                        "exam_code": raw["exam_code"],
                        "subject_slug": raw["subject_slug"],
                        "question_number": raw["question_number"],
                        "source_docx": raw["source_docx"],
                    }
                )
                continue
            cache[question["id"]] = build_tutor_item(raw, question)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_folder": str(input_dir),
        "docx_file_count": len(docx_files),
        "parsed_explanation_count": parsed_count,
        "matched_cache_count": len(cache),
        "unmatched_count": len(unmatched),
        "unmatched": unmatched[:200],
    }
    write_json(Path(args.output), cache)
    write_json(Path(args.report), report)
    print(f"imported {len(cache)} matched explanations from {parsed_count} parsed blocks")
    print(f"report -> {args.report}")
    return 0 if len(cache) else 1


if __name__ == "__main__":
    raise SystemExit(main())
