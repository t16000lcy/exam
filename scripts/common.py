from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "uploads" / "pdf"
PARSED_DIR = ROOT / "uploads" / "parsed"
QUESTIONS_RAW_DIR = PARSED_DIR / "questions"
ANSWERS_RAW_DIR = PARSED_DIR / "answers"
DATA_QUESTIONS_DIR = ROOT / "data" / "questions"
ASSET_DIR = ROOT / "public" / "question-assets"

SUBJECTS = {
    "臨床生理學與病理學": "clinical-physiology-pathology",
    "臨床血液學與血庫學": "hematology-blood-bank",
    "醫學分子檢驗學與臨床鏡檢學": "molecular-microscopy-parasitology",
    "微生物學與臨床微生物學": "microbiology-clinical-microbiology",
    "生物化學與臨床生化學": "biochemistry-clinical-biochemistry",
    "臨床血清免疫學與臨床病毒學": "serology-immunology-virology",
}

SLUG_TO_SUBJECT = {slug: subject for subject, slug in SUBJECTS.items()}


def ensure_dirs() -> None:
    for path in [PDF_DIR, QUESTIONS_RAW_DIR, ANSWERS_RAW_DIR, DATA_QUESTIONS_DIR, ASSET_DIR]:
        path.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_text(text: str) -> str:
    text = text.replace("\u3000", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def infer_filename_metadata(path: Path) -> dict[str, str]:
    name = path.stem
    parent = path.parent.name
    year = ""
    session = ""
    subject = ""
    year_match = re.search(r"(1[0-2]\d)", f"{parent}_{name}")
    if year_match:
        year = year_match.group(1)
    file_match = re.match(r"(1[0-2]\d)[_-](\d{1,2})[_-](.+?)(?:[_-](?:試題|答案|更正答案))?$", name)
    if file_match:
        year = file_match.group(1)
        session = str(int(file_match.group(2)))
        subject = normalize_subject_name(file_match.group(3))
    return {"year": year, "exam_session": session, "subject": subject}


def normalize_subject_name(value: str) -> str:
    value = re.sub(r"\s+", "", value)
    value = value.replace("（包括寄生蟲學）", "")
    value = value.replace("（包括細菌與黴菌）", "")
    for subject in SUBJECTS:
        compact = re.sub(r"\s+", "", subject)
        if value in compact or compact.startswith(value) or value.startswith(compact[:8]):
            return subject
    return value


def infer_year(text: str, fallback: str = "") -> str:
    candidates = re.findall(r"(?:民國)?\s*(1[0-2]\d)\s*年", text)
    if candidates:
        return candidates[0]
    candidates = re.findall(r"(?<!\d)(1[0-2]\d)(?!\d)", text)
    return candidates[0] if candidates else fallback


def infer_exam_session(text: str, fallback: str = "") -> str:
    match = re.search(r"(?:第)?([一二三四五六七八九十\d]+)次", text)
    if not match:
        return fallback
    value = match.group(1)
    chinese_numbers = {
        "一": "1",
        "二": "2",
        "三": "3",
        "四": "4",
        "五": "5",
        "六": "6",
        "七": "7",
        "八": "8",
        "九": "9",
        "十": "10",
    }
    return chinese_numbers.get(value, value)


def infer_exam_code(text: str, fallback: str = "") -> str:
    match = re.search(r"(?:試題代號|代號)[:：\s]*([0-9A-Z-]{2,})", text, re.I)
    return match.group(1) if match else fallback


def infer_subject(text: str, fallback: str = "") -> tuple[str, str]:
    compact = re.sub(r"\s+", "", text)
    for subject, slug in SUBJECTS.items():
        if re.sub(r"\s+", "", subject) in compact:
            return subject, slug
    fallback = normalize_subject_name(fallback)
    if fallback and fallback in SUBJECTS:
        return fallback, SUBJECTS[fallback]
    return fallback, "unknown"


def build_source_label(year: str, session: str, subject: str, question_number: int | None = None) -> str:
    session_text = f"第 {int(session)} 次" if session and session.isdigit() else (f"第 {session} 次" if session else "")
    head = f"{year} 年{session_text}" if year else session_text
    parts = [head, subject]
    if question_number is not None:
        parts.append(f"第 {question_number} 題")
    return "／".join(part for part in parts if part)


def pdf_text(path: Path) -> list[str]:
    try:
        import fitz  # type: ignore

        doc = fitz.open(path)
        return [page.get_text("text") for page in doc]
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return [page.extract_text() or "" for page in reader.pages]


def looks_like_answer_pdf(path: Path, text: str) -> bool:
    lowered = path.name.lower()
    return "答案" in path.name or "answer" in lowered or "解答" in path.name or "更正答案" in text


def question_id(year: str, exam_code: str, subject_slug: str, number: int) -> str:
    safe_code = exam_code or "unknown"
    return f"{year}-{safe_code}-{subject_slug}-{number:02d}"
