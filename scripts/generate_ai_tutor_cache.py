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
    options = question.get("options", [])
    option_text_by_label = {option.get("label", ""): option.get("text", "") for option in options}
    correct_labels = set(question.get("answer") or [])
    correct_option_text = "；".join(
        f"{label}. {option_text_by_label.get(label, '')}".strip()
        for label in ["A", "B", "C", "D"]
        if label in correct_labels
    )
    option_analysis = {}
    for option in options:
        label = option.get("label", "")
        text = option.get("text", "")
        if is_all_correct:
            option_analysis[label] = "官方答案為一律給分，本題不適合作為自動評分題。"
        elif label in correct_labels:
            option_analysis[label] = f"此選項為官方標示答案。選項內容：{text}"
        else:
            option_analysis[label] = f"此選項非本題官方答案。複習時請將「{text}」與正確選項的關鍵差異比對。"

    source_label = question.get("source_label") or f"{question.get('year', '')} 年第 {question.get('exam_code', '')} 回第 {question.get('question_number', '')} 題"
    answer_note = "官方答案為一律給分，此題不列入錯題統計。" if is_all_correct else f"官方答案標示為 {correct}。"
    image_note = "本題需搭配原圖判讀；AI 訂正不可硬猜圖片內容。" if needs_image else ""
    review_note = "本題目前尚未有教師逐題審核解析，以下先依 parser 題幹、選項與官方答案產生訂正稿。"
    why_correct = " ".join(part for part in [
        answer_note,
        f"正確選項內容：{correct_option_text}" if correct_option_text and not is_all_correct else "",
        image_note,
        review_note,
    ] if part)

    practice_question = (
        f"同樣以「{topic}」為考點，請重新判斷一題相同觀念的變化題；先找題幹關鍵字，再比較 A-D 選項。"
        if topic != "待分類"
        else "請先從題幹找出可分類的關鍵字，再練習判斷相同觀念的變化題。"
    )

    return {
        "question_id": question.get("question_id") or question.get("id", ""),
        "core_concept": (
            f"本題來源為 {source_label}。目前 topic 標記為「{topic}」。"
            if topic != "待分類"
            else f"本題來源為 {source_label}。目前 topic 尚待分類，需由教師或後續規則再標記考點。"
        ),
        "correct_answer_text": f"正確答案是：{correct}",
        "why_correct": why_correct,
        "option_analysis": {label: option_analysis.get(label, "") for label in ["A", "B", "C", "D"]},
        "memory_sentence": (
            "圖片題先看原圖關鍵，再回到題幹與官方答案比對。"
            if needs_image
            else "先抓題幹關鍵字，再用官方答案回推考點與排除理由。"
        ),
        "practice_question": practice_question,
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
