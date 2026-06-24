from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from normalize_questions import infer_topic, load_json, write_json


FORMAT_NOTICE = "此題尚未建立完整 AI 訂正解析。"

SYSTEM_PROMPT = """你是「醫檢國考 AI 訂正小老師」，任務是針對醫事檢驗師國考題目產生逐題訂正解析。

請根據題幹、選項、官方答案、科目、topic 與 subtopic 產生解題內容。

規則：
1. 使用繁體中文。
2. 回答對象是醫技系學生與醫事檢驗師國考準備者。
3. 不要過度延伸臨床治療，只聚焦國考需要的醫檢與檢驗學觀念。
4. 不要編造參考文獻。
5. 若資料不足，請標示「需教師確認」。
6. 若題目需要圖片，請標示「本題需搭配原圖判讀」。
7. 若官方答案為一律給分，請標示「官方答案為一律給分，不列入錯題統計」。
8. 選項解析必須逐項說明 A、B、C、D。
9. 再練習題必須是同觀念變化題，不可完全複製原題。
10. 請輸出符合 ai_tutor schema 的 JSON，不要輸出 markdown，不要輸出多餘文字。"""


def get_question_id(question: dict) -> str:
    return str(question.get("question_id") or question.get("id") or "")


def get_options(question: dict) -> dict[str, str]:
    raw = question.get("options") or question.get("standard_options") or {}
    if isinstance(raw, dict):
        return {label: str(raw.get(label, "")) for label in ["A", "B", "C", "D"]}
    return {
        label: next((str(item.get("text", "")) for item in raw if item.get("label") == label), "")
        for label in ["A", "B", "C", "D"]
    }


def get_question_text(question: dict) -> str:
    return str(question.get("question_text") or question.get("stem") or "")


def get_question_no(question: dict) -> int:
    return int(question.get("question_no") or question.get("question_number") or 0)


def get_correct_answer(question: dict) -> str:
    if question.get("is_all_correct") or question.get("answer_type") == "all_credit":
        return "ALL"
    if question.get("correct_answer"):
        return str(question["correct_answer"])
    answer = question.get("answer") or []
    return " 或 ".join(str(item) for item in answer)


def build_ai_full_text(item: dict) -> str:
    options = item["option_analysis"]
    return "\n\n".join(
        [
            f"【本題考點】\n{item['core_concept']}",
            f"【正確答案】\n{item['correct_answer_text']}",
            f"【為什麼正確】\n{item['why_correct']}",
            f"【學生錯因分析】\n{item['student_wrong_reason']}",
            "【選項解析】\n"
            + "\n".join(f"{label}：{options.get(label, '')}" for label in ["A", "B", "C", "D"]),
            f"【考前記憶句】\n{item['memory_sentence']}",
            f"【再練習一題】\n{item['practice_question']}",
        ]
    )


def template_for(question: dict, topic: str) -> dict:
    question_id = get_question_id(question)
    correct = get_correct_answer(question)
    options = get_options(question)
    is_all_correct = correct == "ALL"
    requires_image = bool(question.get("requires_image") or question.get("has_image") or question.get("image_paths"))
    needs_teacher_check = is_all_correct or requires_image or topic == "待分類"
    exam_round = question.get("exam_round") or (
        "第一次" if str(question.get("exam_code", "")) == "1" else "第二次" if str(question.get("exam_code", "")) == "2" else str(question.get("exam_code", ""))
    )
    source = f"{question.get('year', '')} 年{exam_round} {question.get('subject', '')} 第 {get_question_no(question)} 題"

    if is_all_correct:
        correct_answer_text = "本題官方答案為一律給分。"
        why_correct = "官方答案標示為一律給分，代表本題不適合用單一選項判定學生對錯，需以教師審核版解析為準。"
    else:
        correct_answer_text = f"正確答案是：{correct}"
        why_correct = (
            "目前尚未產生真正逐題詳解；本欄僅依官方答案、題幹與選項建立待補草稿。"
            "後續需由 AI 批次詳解或教師審核版補上判斷邏輯。"
        )

    option_analysis: dict[str, str] = {}
    correct_labels = set(correct.replace(" ", "").split("或")) if correct and not is_all_correct else set()
    for label in ["A", "B", "C", "D"]:
        text = options.get(label, "")
        if is_all_correct:
            option_analysis[label] = f"{text}。本題官方一律給分，需教師確認各選項解析。".strip()
        elif label in correct_labels:
            option_analysis[label] = f"{text}。此選項為官方答案，仍需補上判斷邏輯與關鍵鑑別點。".strip()
        else:
            option_analysis[label] = f"{text}。此選項不是官方答案，仍需補上為何排除的判斷邏輯。".strip()

    warnings: list[str] = []
    if requires_image:
        warnings.append("本題需搭配原圖判讀")
    if is_all_correct:
        warnings.append("官方答案為一律給分，不列入錯題統計")
    if needs_teacher_check:
        warnings.append("可能需教師確認")

    item = {
        "question_id": question_id,
        "ai_version": "v1",
        "review_status": "unreviewed",
        "core_concept": (
            f"本題來源為 {source}。目前 topic 為「{topic}」。"
            "完整考點尚未由 AI 或教師逐題標註。"
        ),
        "correct_answer_text": correct_answer_text,
        "why_correct": why_correct,
        "student_wrong_reason": (
            "學生可能只背答案，尚未掌握題幹關鍵字、檢驗條件或選項間的鑑別點。"
            "待完整詳解產生後，應改寫為針對本題內容的錯因分析。"
        ),
        "option_analysis": option_analysis,
        "memory_sentence": "先抓題幹關鍵字，再逐一排除選項；圖表題需回到原圖判讀。" if requires_image else "先抓題幹關鍵字，再逐一排除選項。",
        "practice_question": "此題尚未產生同觀念練習題，需待 AI 批次詳解或教師審核後補上。",
        "practice_options": {"A": "", "B": "", "C": "", "D": ""},
        "practice_answer": "",
        "ai_full_text": "",
        "warnings": warnings,
        "teacher_review_status": "unreviewed",
        "needs_teacher_check": needs_teacher_check,
        "generated_source": "template",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    item["template_full_text"] = f"{FORMAT_NOTICE}\n\n" + build_ai_full_text(item)
    return item


def load_questions(input_path: Path) -> list[dict]:
    if input_path.exists():
        return load_json(input_path, [])
    questions: list[dict] = []
    for path in sorted(Path("data/questions").glob("*.json")):
        questions.extend(load_json(path, []))
    return questions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/questions_master.json")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--rules", default="data/topic_rules.json")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    questions = load_questions(Path(args.input))
    cache_path = Path(args.output)
    cache = {} if args.force else load_json(cache_path, {})
    rules = load_json(Path(args.rules), [])
    has_api_key = bool(os.environ.get("OPENAI_API_KEY"))
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "has_openai_api_key": has_api_key,
        "mode": "template" if not has_api_key else "template_only_in_this_script",
        "generated": 0,
        "template": 0,
        "failed": [],
        "note": "未偵測到 OPENAI_API_KEY，依規則僅產生待補模板。" if not has_api_key else "本腳本不呼叫前端或寫入 API key；正式 AI 生成請使用後端批次流程。",
    }

    for index, question in enumerate(questions, start=1):
        question_id = get_question_id(question)
        if not question_id:
            report["failed"].append({"reason": "missing_question_id", "question": get_question_text(question)[:80]})
            continue
        if question_id in cache and not args.force:
            continue
        cache[question_id] = template_for(question, infer_topic(question, rules))
        report["template"] += 1
        if index % 20 == 0:
            write_json(cache_path, cache)
            write_json(Path("data/ai_generation_report.json"), report)

    write_json(cache_path, cache)
    write_json(Path("data/ai_generation_report.json"), report)
    print(f"ai tutor cache contains {len(cache)} items -> {cache_path}")
    print(f"generated_source=template count={report['template']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
