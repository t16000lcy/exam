from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from generate_ai_tutor_cache import template_for
from normalize_questions import infer_topic, load_json, write_json


SYSTEM_PROMPT = """你是醫事檢驗師國考輔導老師，專長為臨床生理學、臨床血液學、血庫學、醫學分子檢驗、臨床鏡檢、寄生蟲學、微生物學、臨床生化、血清免疫與病毒學。

請根據題目、選項、官方答案與學生可能的錯誤作答，產生真正的國考訂正解析。

規則：
1. 使用繁體中文。
2. 不要只給答案，要說明判斷邏輯。
3. 回答對象是醫技系學生與準備醫事檢驗師國考者。
4. 不要過度延伸臨床治療，只聚焦國考需要的檢驗學觀念。
5. 若資料不足，不可編造參考文獻或假裝查閱資料。
6. 若題目需要圖片但未提供圖片內容，請明確寫「本題需搭配原圖判讀」。
7. 若題目可能有爭議、官方答案為一律給分、或僅靠文字無法完整判斷，請標示「可能需教師確認」。
8. 不要產生危險醫療建議。
9. 固定輸出下列段落，不要省略標題：
【本題考點】
【正確答案】
【為什麼是這個答案】
【選項解析】
【考前記憶句】
【再練習】
"""


def question_payload(question: dict, topic: str) -> str:
    correct = "一律給分" if question.get("answer_type") == "all_credit" else " 或 ".join(question.get("answer") or [])
    options = "\n".join(f"{item.get('label')}. {item.get('text', '')}" for item in question.get("options", []))
    image_note = "是" if question.get("has_image") or question.get("requires_image") or question.get("image_paths") else "否"
    return "\n".join(
        [
            f"question_id: {question.get('id') or question.get('question_id', '')}",
            f"來源: {question.get('source_label', '')}",
            f"科目: {question.get('subject', '')}",
            f"topic: {topic}",
            f"圖片題: {image_note}",
            f"題幹: {question.get('stem') or question.get('question_text', '')}",
            "選項:",
            options,
            f"官方答案: {correct}",
            f"更正答案: {question.get('corrected_answer', '')}",
        ]
    )


def call_openai(prompt: str, model: str, api_key: str) -> str:
    body = json.dumps(
        {
            "model": model,
            "input": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        data = json.loads(response.read().decode("utf-8"))
    if data.get("output_text"):
        return data["output_text"].strip()
    chunks: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                chunks.append(text)
    return "\n".join(chunks).strip()


def load_questions(input_path: Path) -> list[dict]:
    if input_path.exists():
        data = load_json(input_path, [])
        if isinstance(data, list):
            return data
    questions: list[dict] = []
    for path in sorted(Path("data/questions").glob("*.json")):
        questions.extend(load_json(path, []))
    return questions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/questions_master.json")
    parser.add_argument("--output", default="data/ai_tutor_cache.json")
    parser.add_argument("--rules", default="data/topic_rules.json")
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))
    parser.add_argument("--limit", type=int, default=0, help="0 means no limit")
    parser.add_argument("--resume", action="store_true", help="skip questions that already have ai_full_text")
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is not set. Stop: true AI explanations were not generated.")
        return 2

    questions = load_questions(Path(args.input))
    rules = load_json(Path(args.rules), [])
    cache_path = Path(args.output)
    cache = load_json(cache_path, {})
    generated = 0

    for index, question in enumerate(questions, start=1):
        question_id = question.get("question_id") or question.get("id")
        if not question_id:
            continue
        if args.resume and cache.get(question_id, {}).get("ai_full_text"):
            continue
        topic = infer_topic(question, rules)
        item = cache.get(question_id) or template_for(question, topic)
        try:
            full_text = call_openai(question_payload(question, topic), args.model, api_key)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenAI HTTP {error.code}: {detail}") from error
        item["ai_full_text"] = full_text
        item["generated_source"] = "ai"
        item["teacher_review_status"] = item.get("teacher_review_status") or "unreviewed"
        item["generated_at"] = datetime.now(timezone.utc).isoformat()
        cache[question_id] = item
        generated += 1
        if generated % 20 == 0:
            write_json(cache_path, cache)
            print(f"saved {generated} generated explanations, last={question_id}")
        if args.limit and generated >= args.limit:
            break
        time.sleep(args.sleep)

    write_json(cache_path, cache)
    print(f"generated {generated} true AI explanations -> {cache_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
