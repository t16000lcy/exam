from __future__ import annotations

import argparse
import re
from pathlib import Path

from common import (
    ASSET_DIR,
    PDF_DIR,
    QUESTIONS_RAW_DIR,
    build_source_label,
    clean_text,
    ensure_dirs,
    infer_exam_code,
    infer_exam_session,
    infer_filename_metadata,
    infer_subject,
    infer_year,
    looks_like_answer_pdf,
    pdf_text,
    question_id,
    write_json,
)

IMAGE_KEYWORDS = ["圖", "心電圖", "ECG", "EKG", "鏡檢", "血液抹片", "抹片", "影像", "下列圖片"]
OPTION_PATTERN = re.compile(r"(?P<label>[ABCD])[\.\、．)]\s*(?P<text>.*?)(?=(?:\s*[ABCD][\.\、．)]\s*)|$)", re.S)


def split_question_blocks(text: str) -> list[tuple[int, str]]:
    normalized = clean_text(text)
    pattern = re.compile(r"(?:^|\n)\s*(?P<number>[1-8]?\d)[\.\、．]\s*", re.M)
    matches = list(pattern.finditer(normalized))
    blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        number = int(match.group("number"))
        if not 1 <= number <= 80:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        block = normalized[start:end].strip()
        if block:
            blocks.append((number, block))
    seen: set[int] = set()
    unique: list[tuple[int, str]] = []
    for number, block in blocks:
        if number not in seen:
            unique.append((number, block))
            seen.add(number)
    return unique


def parse_options(block: str) -> tuple[str, list[dict[str, str]]]:
    first_option = re.search(r"\sA[\.\、．)]\s*", block)
    if not first_option:
        return block.strip(), []
    stem = block[: first_option.start()].strip()
    option_text = block[first_option.start() :].strip()
    options = []
    for match in OPTION_PATTERN.finditer(option_text):
        label = match.group("label")
        text = clean_text(match.group("text"))
        if label in "ABCD":
            options.append({"label": label, "text": text})
    return stem, options


def export_page_images(pdf_path: Path, year: str, exam_code: str, pages: set[int]) -> list[str]:
    if not pages:
        return []
    try:
        import fitz  # type: ignore
    except Exception:
        return []

    doc = fitz.open(pdf_path)
    exported: list[str] = []
    target_dir = ASSET_DIR / (year or "unknown") / (exam_code or pdf_path.stem)
    target_dir.mkdir(parents=True, exist_ok=True)
    for page_index in pages:
        if page_index < 0 or page_index >= len(doc):
            continue
        page = doc[page_index]
        has_embedded_images = bool(page.get_images(full=True))
        page_text = page.get_text("text")
        has_keyword = any(keyword.lower() in page_text.lower() for keyword in IMAGE_KEYWORDS)
        if not has_embedded_images and not has_keyword:
            continue
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        filename = f"{pdf_path.stem}-page-{page_index + 1}.png"
        output = target_dir / filename
        pix.save(output)
        exported.append(str(output.relative_to(ASSET_DIR.parents[0])).replace("\\", "/"))
    return exported


def parse_pdf(pdf_path: Path) -> list[dict]:
    pages = pdf_text(pdf_path)
    all_text = "\n".join(pages)
    if looks_like_answer_pdf(pdf_path, all_text):
        return []
    filename_meta = infer_filename_metadata(pdf_path)
    year = infer_year(all_text, filename_meta["year"])
    exam_session = infer_exam_session(all_text, filename_meta["exam_session"])
    exam_code = infer_exam_code(all_text, exam_session or pdf_path.stem)
    subject, subject_slug = infer_subject(all_text, filename_meta["subject"])
    questions: list[dict] = []
    page_offsets: list[tuple[int, int, int]] = []
    cursor = 0
    combined_parts = []
    for page_index, page_text in enumerate(pages):
        start = cursor
        combined_parts.append(page_text)
        cursor += len(page_text) + 1
        page_offsets.append((start, cursor, page_index))
    combined_text = "\n".join(combined_parts)

    for number, block, block_start in split_question_blocks_with_offsets(combined_text):
        stem, options = parse_options(block)
        page_has_image = any(keyword.lower() in block.lower() for keyword in IMAGE_KEYWORDS)
        page_index = page_for_offset(page_offsets, block_start)
        questions.append(
            {
                "id": question_id(year, exam_code, subject_slug, number),
                "year": year,
                "exam_code": exam_code,
                "exam_session": exam_session,
                "source_label": build_source_label(year, exam_session, subject, number),
                "subject": subject,
                "subject_slug": subject_slug,
                "question_number": number,
                "stem": stem,
                "options": options,
                "has_image": page_has_image,
                "image_paths": [],
                "source_pdf": str(pdf_path.relative_to(PDF_DIR)).replace("\\", "/"),
                "_page_index": page_index,
            }
        )

    image_pages = {q["_page_index"] for q in questions if q["has_image"]}
    page_images = export_page_images(pdf_path, year, exam_code, image_pages)
    for question in questions:
        if question["has_image"]:
            question["image_paths"] = page_images
        question.pop("_page_index", None)
    return questions


def split_question_blocks_with_offsets(text: str) -> list[tuple[int, str, int]]:
    normalized = clean_text(text)
    pattern = re.compile(r"(?:^|\n)\s*(?P<number>[1-8]?\d)[\.\、．]\s*", re.M)
    matches = list(pattern.finditer(normalized))
    blocks: list[tuple[int, str, int]] = []
    for index, match in enumerate(matches):
        number = int(match.group("number"))
        if not 1 <= number <= 80:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        block = normalized[start:end].strip()
        if block:
            blocks.append((number, block, start))
    seen: set[int] = set()
    unique: list[tuple[int, str, int]] = []
    for number, block, start in blocks:
        if number not in seen:
            unique.append((number, block, start))
            seen.add(number)
    return unique


def page_for_offset(page_offsets: list[tuple[int, int, int]], offset: int) -> int:
    for start, end, page_index in page_offsets:
        if start <= offset < end:
            return page_index
    return page_offsets[-1][2] if page_offsets else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract question metadata from exam PDFs.")
    parser.add_argument("--pdf-dir", default=str(PDF_DIR))
    args = parser.parse_args()
    ensure_dirs()
    pdfs = sorted(Path(args.pdf_dir).rglob("*.pdf"))
    if not pdfs:
        print(f"找不到 PDF：{args.pdf_dir}")
        return 1

    total = 0
    for pdf_path in pdfs:
        questions = parse_pdf(pdf_path)
        if not questions:
            continue
        output = QUESTIONS_RAW_DIR / f"{pdf_path.parent.name}_{pdf_path.stem}.json"
        write_json(output, questions)
        total += len(questions)
        print(f"{pdf_path}: {len(questions)} questions")
    print(f"完成擷取 {total} 題。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
