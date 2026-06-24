from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


FORBIDDEN_PHRASES = [
    "與「本科核心概念與臨床檢驗判讀」的核心概念最相符。",
    "看到「本科核心概念與臨床檢驗判讀」題，",
    "與「本科核心概念與臨床檢驗判讀」",
    "本科核心概念與臨床檢驗判讀",
]

TEXT_REPLACEMENTS = [
    ("【本題考點】\n。", "【本題考點】\n本科核心概念。"),
    ("【考前記憶句】\n先抓題幹關鍵字、是否為反向題，再用核心定義或檢驗原理排除相近選項。", "【考前記憶句】\n先抓題幹關鍵字、是否為反向題，再用核心定義或檢驗原理排除相近選項。"),
]

REGEX_REPLACEMENTS = [
    (
        re.compile(
            r"(：(?:正確|對)。此選項最能對應題幹關鍵詞與核心機轉。)"
            r"此選項容易作為干擾項，關鍵是它與題幹所問的核心機轉、用途或臨床情境不完全相符。"
        ),
        r"\1",
    ),
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sanitize_text(text: str) -> tuple[str, int]:
    changed = 0
    current = text
    for phrase in FORBIDDEN_PHRASES:
        count = current.count(phrase)
        current = current.replace(phrase, "")
        changed += count
    for before, after in TEXT_REPLACEMENTS:
        count = current.count(before)
        current = current.replace(before, after)
        changed += count
    for pattern, replacement in REGEX_REPLACEMENTS:
        current, count = pattern.subn(replacement, current)
        changed += count
    current = re.sub(r"\n{3,}", "\n\n", current).strip()
    return current, changed


def sanitize_value(value):
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, list):
        total = 0
        next_list = []
        for item in value:
            next_item, count = sanitize_value(item)
            next_list.append(next_item)
            total += count
        return next_list, total
    if isinstance(value, dict):
        total = 0
        next_dict = {}
        for key, item in value.items():
            next_item, count = sanitize_value(item)
            next_dict[key] = next_item
            total += count
        return next_dict, total
    return value, 0


def count_forbidden(value) -> int:
    text = json.dumps(value, ensure_ascii=False)
    return sum(text.count(item) for item in FORBIDDEN_PHRASES)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/ai_tutor_cache.json")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--report", default="data/ai_tutor_sanitize_report.json")
    args = parser.parse_args()

    cache = load_json(Path(args.input))
    sanitized, replacement_count = sanitize_value(cache)
    write_json(Path(args.output), sanitized)

    report = {
        "item_count": len(cache),
        "replacement_count": replacement_count,
        "forbidden_remaining": count_forbidden(sanitized),
    }
    write_json(Path(args.report), report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["forbidden_remaining"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
