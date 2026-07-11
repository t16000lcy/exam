from __future__ import annotations

import argparse
import json
import random
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


SUBJECTS = {
    "生物化學與臨床生化學": "biochemistry-clinical-biochemistry",
    "微生物學與臨床微生物學（包括細菌與黴菌）": "microbiology-clinical-microbiology",
    "微生物學與臨床微生物學": "microbiology-clinical-microbiology",
    "臨床生理學與病理學": "clinical-physiology-pathology",
    "臨床血液學與血庫學": "hematology-blood-bank",
    "臨床血清免疫學與臨床病毒學": "serology-immunology-virology",
    "醫學分子檢驗學與臨床鏡檢學（包括寄生蟲學）": "molecular-microscopy-parasitology",
    "醫學分子檢驗學與臨床鏡檢學": "molecular-microscopy-parasitology",
}

SUBJECT_ORDER = [
    "biochemistry-clinical-biochemistry",
    "microbiology-clinical-microbiology",
    "clinical-physiology-pathology",
    "hematology-blood-bank",
    "serology-immunology-virology",
    "molecular-microscopy-parasitology",
]

CHINESE_ROUND = {"一": "1", "二": "2"}
SECTION_HEADINGS = {"本題觀念", "選項分析", "答案解析"}
SEPARATOR_RE = re.compile(r"^[─\-—_]{5,}$")
QUESTION_RE = re.compile(r"^第\s*(\d{1,2})\s*題$")
ANSWER_RE = re.compile(r"^答案\s*[:：]\s*(.+)$")


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


def normalize_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.replace("•", "").strip())


def detect_year(path: Path, paragraphs: list[str]) -> str:
    match = re.search(r"(11[0-5])\s*年", path.name)
    if match:
        return match.group(1)
    for line in paragraphs[:20]:
        match = re.search(r"(11[0-5])\s*年", line)
        if match:
            return match.group(1)
    return ""


def detect_subject(line: str, path: Path | None = None) -> str | None:
    target = f"{path.name} {line}" if path else line
    for subject_name, slug in SUBJECTS.items():
        if subject_name in target:
            return slug
    return None


def is_subject_heading(line: str) -> bool:
    normalized = line.strip()
    if normalized.startswith("科目"):
        return True
    return any(normalized == subject_name for subject_name in SUBJECTS)


def detect_exam_code(line: str) -> str | None:
    compact = line.replace(" ", "")
    match = re.search(r"第([一二])次", compact)
    if match:
        return CHINESE_ROUND[match.group(1)]
    match = re.search(r"第([12])次", compact)
    if match:
        return match.group(1)
    match = re.search(r"([一二])次", compact)
    if match:
        return CHINESE_ROUND[match.group(1)]
    return None


def load_question_index(data_dir: Path) -> tuple[dict[tuple[str, str, str, int], dict], dict[str, dict]]:
    by_key: dict[tuple[str, str, str, int], dict] = {}
    by_id: dict[str, dict] = {}
    for path in sorted((data_dir / "questions").glob("*.json")):
        questions = read_json(path, [])
        for question in questions:
            key = (
                str(question.get("year", "")),
                str(question.get("exam_code", "")),
                str(question.get("subject_slug", "")),
                int(question.get("question_number") or 0),
            )
            by_key[key] = question
            by_id[str(question.get("id"))] = question
    return by_key, by_id


def split_docx_items(path: Path) -> list[dict]:
    paragraphs = docx_paragraphs(path)
    year = detect_year(path, paragraphs)
    current_subject = detect_subject("", path)
    current_exam_code: str | None = None
    current_number: int | None = None
    current_lines: list[str] = []
    items: list[dict] = []

    def flush() -> None:
        nonlocal current_number, current_lines
        if year and current_subject and current_exam_code and current_number and current_lines:
            items.append(
                {
                    "year": year,
                    "exam_code": current_exam_code,
                    "subject_slug": current_subject,
                    "question_number": current_number,
                    "lines": current_lines[:],
                    "source_docx": str(path),
                }
            )
        current_number = None
        current_lines = []

    for raw_line in paragraphs:
        line = raw_line.strip()
        if SEPARATOR_RE.match(line):
            flush()
            continue

        subject = detect_subject(line)
        exam_code = detect_exam_code(line)
        is_session_heading = bool(re.search(r"11[0-5]\s*年.*第[一二12]次", line.replace(" ", "")))

        if subject and not QUESTION_RE.match(line):
            if current_number is None or is_session_heading or is_subject_heading(line):
                flush()
                current_subject = subject

        if is_session_heading and exam_code:
            flush()
            current_exam_code = exam_code
            if subject:
                current_subject = subject
            continue

        question_match = QUESTION_RE.match(line)
        if question_match:
            flush()
            current_number = int(question_match.group(1))
            current_lines = []
            continue

        if current_number is not None:
            current_lines.append(line)

    flush()
    return items


def strip_bullet(line: str) -> str:
    return normalize_line(line)


def parse_item_lines(lines: list[str]) -> dict:
    stem_lines: list[str] = []
    options: dict[str, str] = {}
    concept_lines: list[str] = []
    answer_explanation_lines: list[str] = []
    option_analysis: dict[str, str] = {"A": "", "B": "", "C": "", "D": ""}
    correct_raw = ""
    section = "stem"
    current_option: str | None = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        answer_match = ANSWER_RE.match(line)
        if answer_match:
            correct_raw = answer_match.group(1).strip()
            section = "after_answer"
            current_option = None
            continue

        heading = line.rstrip("：:")
        if heading in SECTION_HEADINGS:
            section = heading
            current_option = None
            continue

        if line.startswith("題目：") or line.startswith("題目:"):
            stem_lines.append(line.split("：", 1)[-1].strip() if "：" in line else line.split(":", 1)[-1].strip())
            section = "stem"
            continue

        option_match = re.match(r"^[•\s]*([ABCD])[\.\、]\s*(.+)$", line)
        if section == "stem" and option_match:
            options[option_match.group(1)] = strip_bullet(option_match.group(2))
            continue

        if section == "選項分析":
            analysis_match = re.match(r"^[•\s]*([ABCD])[\.\、]\s*(.+)$", line)
            if analysis_match:
                current_option = analysis_match.group(1)
                option_analysis[current_option] = strip_bullet(analysis_match.group(2))
                continue
            if line.startswith("解析：") or line.startswith("解析:"):
                text = line.split("：", 1)[-1].strip() if "：" in line else line.split(":", 1)[-1].strip()
                if current_option:
                    option_analysis[current_option] = (option_analysis[current_option] + " " + text).strip()
                continue
            if current_option:
                option_analysis[current_option] = (option_analysis[current_option] + " " + strip_bullet(line)).strip()
            continue

        if section == "本題觀念":
            concept_lines.append(strip_bullet(line))
            continue

        if section == "答案解析":
            answer_explanation_lines.append(strip_bullet(line))
            continue

        if section == "stem":
            stem_lines.append(strip_bullet(line))

    correct_match = re.match(r"([ABCD])", correct_raw.strip())
    correct_label = correct_match.group(1) if correct_match else correct_raw.strip()
    return {
        "stem": "\n".join(stem_lines).strip(),
        "options": options,
        "correct_label": correct_label,
        "correct_raw": correct_raw,
        "concept": "\n".join(concept_lines).strip(),
        "answer_explanation": "\n".join(answer_explanation_lines).strip(),
        "option_analysis": option_analysis,
    }


def option_text(question: dict, label: str) -> str:
    for option in question.get("options", []):
        if option.get("label") == label:
            return str(option.get("text", "")).strip()
    return ""


def question_block(question: dict) -> str:
    parts = [f"題目：{question.get('stem', '').strip()}"]
    for option in question.get("options", []):
        parts.append(f"{option.get('label')}. {option.get('text', '').strip()}")
    return "\n".join(parts)


def practice_block(question: dict, seed: str) -> str:
    options = list(question.get("options", []))
    rng = random.Random(seed)
    rng.shuffle(options)
    labels = ["A", "B", "C", "D"]
    lines = [
        "請遮住上方解析，將同一題的選項順序打亂後再作答一次。",
        f"題目：{question.get('stem', '').strip()}",
    ]
    for label, option in zip(labels, options):
        lines.append(f"{label}. {option.get('text', '').strip()}")
    return "\n".join(lines)


def build_memory_sentence(question: dict, parsed: dict) -> str:
    correct = parsed["correct_label"]
    correct_text = option_text(question, correct)
    concept = parsed["concept"].split("。")[0].strip()
    if concept:
        return f"先抓題幹關鍵字；本題記住：{concept}。"
    if correct_text:
        return f"看到本題關鍵字，先連到「{correct_text}」，再逐項排除相近選項。"
    return "先圈題幹關鍵字與否定詞，再回到檢驗原理或臨床判讀條件。"


def build_ai_text(question: dict, parsed: dict) -> str:
    correct = parsed["correct_label"]
    correct_text = option_text(question, correct)
    correct_line = f"{correct}（{correct_text}）" if correct_text else parsed["correct_raw"] or correct
    core_parts = [part for part in [parsed["concept"], parsed["answer_explanation"]] if part]
    core_text = "\n".join(core_parts).strip() or "本題解析資料尚需教師確認。"
    option_lines = []
    for label in ["A", "B", "C", "D"]:
        text = parsed["option_analysis"].get(label) or option_text(question, label)
        option_lines.append(f"{label}. {text}".strip())
    return "\n".join(
        [
            question_block(question),
            "",
            "【正確答案】",
            correct_line,
            "【核心機轉與臨床解析】",
            core_text,
            "【錯誤選項鑑別】",
            "\n".join(option_lines),
            "【考前記憶句】",
            build_memory_sentence(question, parsed),
            "【再練習】",
            practice_block(question, question.get("id", "")),
        ]
    ).strip()


def build_cache_item(raw: dict, question: dict, parsed: dict) -> dict:
    correct = parsed["correct_label"]
    warnings = []
    if question.get("has_image") or question.get("image_paths"):
        warnings.append("圖片題仍須搭配原始題圖判讀。")
    if question.get("answer_type") != "single":
        warnings.append("官方答案型態非單選，需確認更正答案或給分規則。")
    item = {
        "question_id": question["id"],
        "ai_version": "teacher-docx-v3-20260711",
        "review_status": "teacher_docx_imported",
        "core_concept": parsed["concept"],
        "correct_answer_text": correct,
        "why_correct": parsed["answer_explanation"],
        "option_analysis": parsed["option_analysis"],
        "memory_sentence": build_memory_sentence(question, parsed),
        "practice_question": question.get("stem", ""),
        "practice_options": {o["label"]: o.get("text", "") for o in question.get("options", [])},
        "practice_answer": "",
        "ai_full_text": build_ai_text(question, parsed),
        "warnings": warnings,
        "teacher_review_status": "imported_from_teacher_docx",
        "needs_teacher_check": bool(warnings),
        "generated_source": "teacher_docx",
        "source_docx": raw["source_docx"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    return item


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--report", default="data/ai_tutor_import_report.json")
    args = parser.parse_args()

    input_dir = Path(args.input)
    data_dir = Path(args.data_dir)
    question_index, _ = load_question_index(data_dir)
    cache: dict[str, dict] = {}
    parsed_total = 0
    imported = 0
    unmatched: list[dict] = []
    duplicates: list[str] = []
    failed: list[dict] = []
    per_docx: dict[str, int] = {}

    for docx in sorted(input_dir.rglob("*.docx")):
        try:
            raw_items = split_docx_items(docx)
        except Exception as exc:  # noqa: BLE001 - report and continue through independent files.
            failed.append({"path": str(docx), "error": str(exc)})
            continue
        per_docx[str(docx)] = len(raw_items)
        for raw in raw_items:
            parsed_total += 1
            key = (raw["year"], raw["exam_code"], raw["subject_slug"], raw["question_number"])
            question = question_index.get(key)
            if not question:
                unmatched.append({k: raw[k] for k in ["year", "exam_code", "subject_slug", "question_number", "source_docx"]})
                continue
            parsed = parse_item_lines(raw["lines"])
            question_id = question["id"]
            if question_id in cache:
                duplicates.append(question_id)
            cache[question_id] = build_cache_item(raw, question, parsed)
            imported += 1

    missing_question_ids = sorted({q["id"] for q in question_index.values()} - set(cache))
    report = {
        "input_dir": str(input_dir),
        "docx_files": len(list(input_dir.rglob("*.docx"))),
        "parsed_total": parsed_total,
        "imported": imported,
        "cache_count": len(cache),
        "unmatched_count": len(unmatched),
        "duplicate_count": len(duplicates),
        "missing_question_count": len(missing_question_ids),
        "failed_docx_count": len(failed),
        "per_docx": per_docx,
        "unmatched": unmatched[:50],
        "duplicates": duplicates[:50],
        "missing_question_ids": missing_question_ids[:50],
        "failed_docx": failed,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(Path(args.report), report)

    if unmatched or duplicates or missing_question_ids or failed or len(cache) != len(question_index):
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2

    write_json(Path(args.output), cache)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
