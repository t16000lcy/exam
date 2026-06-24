from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--cache", default="data/ai_tutor_cache.json")
    parser.add_argument("--report", default="data/ai_tutor_hash_fix_report.json")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    cache = load_json(Path(args.cache))
    questions = []
    for path in sorted((data_dir / "questions").glob("*.json")):
        questions.extend(load_json(path))
    qmap = {question["id"]: question for question in questions}

    fixed: list[dict] = []
    for question_id, item in cache.items():
        full_text = item.get("ai_full_text", "")
        if "正確答案是：#" not in full_text and item.get("correct_answer_text") != "正確答案是：#":
            continue
        question = qmap.get(question_id)
        if not question:
            continue
        answer_display = build_answer_display(question)
        answer_letters = build_answer_letters(question)
        full_text = full_text.replace("正確答案是：#", f"正確答案是：{answer_display}")
        full_text = full_text.replace("官方答案為 #，其選項內容為「」", f"官方答案為 {answer_letters}，其選項內容為「{answer_option_text(question)}」")
        full_text = full_text.replace("答案判讀方向：#。", f"答案判讀方向：{answer_display}。")
        item["ai_full_text"] = full_text
        item["correct_answer_text"] = f"正確答案是：{answer_display}"
        item["why_correct"] = item.get("why_correct", "").replace(
            "官方答案為 #，其選項內容為「」",
            f"官方答案為 {answer_letters}，其選項內容為「{answer_option_text(question)}」",
        )
        item["practice_answer"] = answer_letters
        fixed.append({"question_id": question_id, "answer": answer_display})

    write_json(Path(args.cache), cache)
    report = {"fixed_count": len(fixed), "fixed": fixed}
    write_json(Path(args.report), report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def build_answer_letters(question: dict) -> str:
    if question.get("answer_type") == "all_credit":
        return "一律給分"
    return " 或 ".join(question.get("answer") or [])


def build_answer_display(question: dict) -> str:
    if question.get("answer_type") == "all_credit":
        return "一律給分"
    answer = question.get("answer") or []
    option_map = {option["label"]: option.get("text", "") for option in question.get("options", [])}
    return " 或 ".join(f"{label}（{option_map.get(label, '')}）" for label in answer)


def answer_option_text(question: dict) -> str:
    if question.get("answer_type") == "all_credit":
        return "一律給分"
    option_map = {option["label"]: option.get("text", "") for option in question.get("options", [])}
    return "；".join(option_map.get(label, "") for label in question.get("answer") or [])


if __name__ == "__main__":
    raise SystemExit(main())
