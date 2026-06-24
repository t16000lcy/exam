from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--cache", default="data/ai_tutor_cache.json")
    parser.add_argument("--output", default="data/ai_tutor_debug_report.json")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    cache = load_json(Path(args.cache))
    questions = []
    for path in sorted((data_dir / "questions").glob("*.json")):
        questions.extend(load_json(path))
    qmap = {question["id"]: question for question in questions}

    issues: list[dict] = []
    hash_answer_ids: list[str] = []
    for question_id, item in cache.items():
        question = qmap.get(question_id)
        if not question:
            issues.append({"type": "missing_question", "question_id": question_id})
            continue
        text = item.get("ai_full_text", "")
        if not text:
            issues.append({"type": "empty_ai_full_text", "question_id": question_id})
            continue
        if has_forbidden_phrase(text):
            issues.append({"type": "forbidden_phrase", "question_id": question_id})
        if "正確答案是：#" in text:
            hash_answer_ids.append(question_id)

        expected = "一律給分" if question.get("answer_type") == "all_credit" else "".join(question.get("answer") or [])
        got = extract_answer_letter(text)
        if expected and expected != "一律給分" and got and not any(letter in got for letter in expected):
            issues.append({"type": "answer_mismatch", "question_id": question_id, "expected": expected, "actual": got})

    report = {
        "question_count": len(questions),
        "cache_count": len(cache),
        "empty_ai_full_text_count": sum(1 for item in cache.values() if not item.get("ai_full_text")),
        "forbidden_phrase_count": sum(1 for question_id, item in cache.items() if has_forbidden_phrase(item.get("ai_full_text", ""))),
        "hash_answer_count": len(hash_answer_ids),
        "hash_answer_ids": hash_answer_ids[:100],
        "issue_count": len(issues),
        "issues": issues[:200],
    }
    write_json(Path(args.output), report)
    print(json.dumps(report, ensure_ascii=False, indent=2)[:2000])
    return 0 if report["issue_count"] == 0 else 1


def has_forbidden_phrase(text: str) -> bool:
    if "核心概念最相符" in text:
        return True
    if re.search(r"看到「[^」]+」題", text):
        return True
    if re.search(r"看到與「[^」]+」相關的選擇題", text):
        return True
    if re.search(r"因此應從此選項與「[^」]+」基本原理不一致處切入", text):
        return True
    return False


def extract_answer_letter(text: str) -> str:
    marker = "正確答案是："
    if marker in text:
        return text.split(marker, 1)[1][:12]
    heading = "【正確答案】"
    if heading not in text:
        return ""
    after = text.split(heading, 1)[1].strip().splitlines()
    return after[0].strip()[:12] if after else ""


if __name__ == "__main__":
    raise SystemExit(main())
