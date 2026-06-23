from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path
from urllib.parse import unquote

import requests

from common import PDF_DIR, ensure_dirs

DEFAULT_FOLDER_URL = "https://drive.google.com/drive/folders/1e1YhzGE6YeT1rKArT_hStA1uiV_Td9mo?usp=sharing"


def folder_id_from_url(url: str) -> str:
    match = re.search(r"/folders/([A-Za-z0-9_-]+)", url)
    if not match:
        raise ValueError("無法從 Google Drive folder URL 取得 folder id。")
    return match.group(1)


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]+', "_", name)
    return re.sub(r"\s+", " ", name).strip()


def find_entries(page: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    pdfs: dict[str, str] = {}
    folders: dict[str, str] = {}
    decoded = html.unescape(page)
    row_pattern = re.compile(
        r'aria-label="(?P<label>[^"]+)"[^>]+data-handled-by-drag-and-drop="true".*?data-id="(?P<id>[A-Za-z0-9_-]+)"',
        re.S,
    )
    for match in row_pattern.finditer(decoded):
        label = unquote(match.group("label"))
        file_id = match.group("id")
        if ".pdf" in label.lower():
            name = re.sub(r"\s+PDF(?:\s+Shared)?\s*$", "", label, flags=re.I)
            pdfs[file_id] = name
        elif "Shared folder" in label:
            name = re.sub(r"\s+Shared folder\s*$", "", label, flags=re.I)
            folders[file_id] = name

    for file_id, name in re.findall(r'\["([A-Za-z0-9_-]{20,})","([^"]+?\.pdf)"', decoded, re.I):
        pdfs[file_id] = unquote(name)
    for name, file_id in re.findall(r'"([^"]+?\.pdf)".{0,500}?"([A-Za-z0-9_-]{20,})"', decoded, re.I | re.S):
        pdfs[file_id] = unquote(name)
    return (
        [(file_id, sanitize_filename(name)) for file_id, name in pdfs.items()],
        [(folder_id, sanitize_filename(name)) for folder_id, name in folders.items()],
    )


def download_file(session: requests.Session, file_id: str, target: Path) -> None:
    url = "https://drive.google.com/uc"
    params = {"export": "download", "id": file_id, "confirm": "t"}
    with session.get(url, params=params, stream=True, timeout=60) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        first_chunk = next(response.iter_content(chunk_size=32768), b"")
        if b"<!DOCTYPE html" in first_chunk[:200] or "text/html" in content_type:
            raise RuntimeError(
                f"{target.name} 無法直接下載，請確認 Drive 權限為「知道連結的人可檢視」。"
            )
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("wb") as handle:
            handle.write(first_chunk)
            for chunk in response.iter_content(chunk_size=32768):
                if chunk:
                    handle.write(chunk)


def sync_folder(
    session: requests.Session,
    folder_id: str,
    target_dir: Path,
    visited: set[str],
) -> tuple[int, list[str]]:
    if folder_id in visited:
        return 0, []
    visited.add(folder_id)
    page_url = f"https://drive.google.com/drive/folders/{folder_id}"
    response = session.get(page_url, timeout=60)
    response.raise_for_status()
    pdf_entries, folder_entries = find_entries(response.text)

    count = 0
    failures: list[str] = []
    for file_id, name in pdf_entries:
        target = target_dir / name
        try:
            print(f"Downloading {target.relative_to(PDF_DIR)}...")
            download_file(session, file_id, target)
            count += 1
        except Exception as exc:
            failures.append(f"{target}: {exc}")

    for child_id, child_name in folder_entries:
        child_count, child_failures = sync_folder(session, child_id, target_dir / child_name, visited)
        count += child_count
        failures.extend(child_failures)
    return count, failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Download all PDF files from a public Google Drive folder.")
    parser.add_argument("--folder-url", default=DEFAULT_FOLDER_URL)
    args = parser.parse_args()
    ensure_dirs()

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    folder_id = folder_id_from_url(args.folder_url)
    count, failures = sync_folder(session, folder_id, PDF_DIR, set())
    if count == 0 and not failures:
        print(
            "沒有找到可下載的 PDF。請確認 Drive folder 權限為「知道連結的人可檢視」，且資料夾中包含 PDF。",
            file=sys.stderr,
        )
        return 1

    if failures:
        print("\n下載失敗：", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(f"完成下載 {count} 個 PDF 到 {PDF_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
