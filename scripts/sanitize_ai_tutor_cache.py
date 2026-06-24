from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


PATTERNS = [
    (re.compile(r"，?與「[^」]+」的核心概念最相符。?"), "。"),
    (re.compile(r"，?因此應從此選項與「[^」]+」基本原理不一致處切入。?"), "。"),
    (re.compile(r"看到「[^」]+」題，"), ""),
    (re.compile(r"看到與「[^」]+」相關的選擇題時"), "看到相關的選擇題時"),
    (re.compile(r"與「本科核心概念與臨床檢驗判讀」的核心概念最相符。?"), ""),
    (re.compile(r"看到「本科核心概念與臨床檢驗判讀」題，"), ""),
    (re.compile(r"看到與「本科核心概念與臨床檢驗判讀」相關的選擇題時"), "看到相關的選擇題時"),
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sanitize_text(text: str) -> tuple[str, int]:
    changed = 0
    current = text
    for pattern, replacement in PATTERNS:
        current, count = pattern.subn(replacement, current)
        changed += count
    current = current.replace("。。", "。")
    current = current.replace("，。", "。")
    current = current.replace("；。", "。")
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


def count_forbidden(value) -> int:
    text = json.dumps(value, ensure_ascii=False)
    forbidden = [
        "與「本科核心概念與臨床檢驗判讀」的核心概念最相符",
        "看到「本科核心概念與臨床檢驗判讀」題",
        "看到與「本科核心概念與臨床檢驗判讀」相關",
    ]
    total = sum(text.count(item) for item in forbidden)
    total += len(re.findall(r"與「[^」]+」的核心概念最相符", text))
    total += len(re.findall(r"因此應從此選項與「[^」]+」基本原理不一致處切入", text))
    total += len(re.findall(r"看到「[^」]+」題", text))
    total += len(re.findall(r"看到與「[^」]+」相關的選擇題", text))
    return total


if __name__ == "__main__":
    raise SystemExit(main())
