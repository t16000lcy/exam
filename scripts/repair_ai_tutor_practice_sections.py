from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


STRATEGY_MARKERS = [
    "國考作答原則",
    "國考解題策略",
    "先圈出題幹",
    "先讀所有選項",
    "不必理解適用條件",
    "只要選項看起來熟悉",
    "看到熟悉名詞",
    "直接作答",
    "反向題最忌",
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_questions(data_dir: Path) -> dict[str, dict]:
    questions: list[dict] = []
    for path in sorted((data_dir / "questions").glob("*.json")):
        questions.extend(load_json(path))
    return {question["id"]: question for question in questions}


def answer_letters(question: dict) -> str:
    if question.get("answer_type") == "all_credit":
        return "一律給分"
    return "".join(question.get("answer") or [])


def option_text(question: dict, letter: str) -> str:
    for option in question.get("options") or []:
        if option.get("label") == letter:
            return str(option.get("text") or "").strip()
    return ""


def build_grounded_practice(question: dict) -> str:
    letters = answer_letters(question)
    if letters == "一律給分":
        answer_line = "本題官方答案為一律給分。請以題幹與各選項概念作為複習重點。"
    else:
        parts = []
        for letter in letters:
            text = option_text(question, letter)
            parts.append(f"{letter}（{text}）" if text else letter)
        answer_line = f"官方答案：{'、'.join(parts)}。"

    stem = str(question.get("stem") or "").strip()
    negative = any(token in stem for token in ["錯誤", "不適當", "不是", "不正確", "何者除外", "最不可能"])
    direction = "本題是反向題，重做時先圈出否定詞，再找出最不符合題幹的選項。" if negative else "本題是正向題，重做時先找題幹關鍵詞，再選最符合核心概念的選項。"

    return "\n".join(
        [
            "【再練習】",
            "請遮住答案後，回到本題題幹與選項再做一次。",
            direction,
            answer_line,
            "訂正時請用自己的話說出兩件事：",
            "1. 為什麼官方答案符合題幹？",
            "2. 至少一個非答案選項錯在什麼關鍵差異？",
        ]
    )


def replace_practice_section(text: str, practice: str) -> tuple[str, bool, bool]:
    match = re.search(r"【再練習[^】]*】", text)
    if not match:
        return f"{text.rstrip()}\n{practice}", True, False
    old_section = text[match.start() :]
    had_strategy = any(marker in old_section for marker in STRATEGY_MARKERS)
    return f"{text[:match.start()].rstrip()}\n{practice}", True, had_strategy


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--cache", default="data/ai_tutor_cache.json")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--report", default="data/ai_tutor_practice_repair_report.json")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    cache = load_json(Path(args.cache))
    questions = load_questions(data_dir)

    changed = 0
    strategy_replaced = 0
    missing_questions: list[str] = []
    for question_id, item in cache.items():
        question = questions.get(question_id)
        if not question:
            missing_questions.append(question_id)
            continue
        text = str(item.get("ai_full_text") or "")
        repaired, did_change, had_strategy = replace_practice_section(text, build_grounded_practice(question))
        if did_change and repaired != text:
            item["ai_full_text"] = repaired
            changed += 1
        if had_strategy:
            strategy_replaced += 1

    write_json(Path(args.output), cache)
    report = {
        "item_count": len(cache),
        "changed_count": changed,
        "strategy_practice_replaced_count": strategy_replaced,
        "missing_question_count": len(missing_questions),
        "missing_questions": missing_questions[:100],
    }
    write_json(Path(args.report), report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not missing_questions else 1


if __name__ == "__main__":
    raise SystemExit(main())
