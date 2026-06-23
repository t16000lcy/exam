from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from normalize_questions import infer_topic, load_json, write_json


def template_for(question: dict, topic: str) -> dict:
    answer_type = question.get("answer_type")
    is_all_correct = answer_type == "all_credit" or question.get("is_all_correct") is True
    correct = "一律給分" if is_all_correct else question.get("correct_answer") or " 或 ".join(question.get("answer") or [])
    needs_image = bool(question.get("requires_image", question.get("has_image")))
    option_analysis = {}
    for option in question.get("options", []):
        label = option.get("label", "")
        if is_all_correct:
            option_analysis[label] = "官方答案為一律給分，本題不適合作為自動評分題。"
        elif label in (question.get("answer") or []):
            option_analysis[label] = "此選項為題庫標示答案之一。"
        else:
            option_analysis[label] = "請依題幹條件與正確答案比較判斷。"
    return {
        "question_id": question.get("question_id") or question.get("id", ""),
        "core_concept": f"本題主要考 {topic}。" if topic != "待分類" else "本題需由教師或題幹關鍵字再標記考點。",
        "correct_answer_text": f"正確答案是：{correct}",
        "why_correct": "本題需搭配原圖判讀。" if needs_image else ("官方答案為一律給分。" if is_all_correct else "待補教師審核解析。"),
        "option_analysis": {label: option_analysis.get(label, "") for label in ["A", "B", "C", "D"]},
        "memory_sentence": "圖片題先看圖像關鍵，再回到題幹條件比對選項。" if needs_image else "先抓題幹關鍵字，再逐一排除選項。",
        "practice_question": "待補相同觀念變化題。",
        "practice_options": {"A": "", "B": "", "C": "", "D": ""},
        "practice_answer": "",
        "teacher_review_status": "unreviewed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/questions_master.json")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--rules", default="data/topic_rules.json")
    args = parser.parse_args()

    input_path = Path(args.input)
    questions = load_json(input_path, []) if input_path.exists() else []
    if not questions:
        for path in sorted(Path("data/questions").glob("*.json")):
            questions.extend(load_json(path, []))

    cache_path = Path(args.output)
    cache = load_json(cache_path, {})
    rules = load_json(Path(args.rules), [])
    for index, question in enumerate(questions, start=1):
        question_id = question.get("question_id") or question.get("id")
        if not question_id or question_id in cache:
            continue
        cache[question_id] = template_for(question, infer_topic(question, rules))
        if index % 20 == 0:
            write_json(cache_path, cache)
    write_json(cache_path, cache)
    print(f"ai tutor cache contains {len(cache)} items -> {cache_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
