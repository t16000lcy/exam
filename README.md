# 醫檢師國考題練習網站

Vite + React + TypeScript + Tailwind CSS 製作的靜態題庫練習網站，可部署到 GitHub Pages。

目前採用「先建立逐題詳解資料庫，再由網站讀取詳解」：

- 不提供自由輸入聊天框。
- 前端不保存、不讀取 `OPENAI_API_KEY`。
- 教師審核版優先於 AI 產生版。
- 沒有完整詳解時顯示「此題尚未建立完整 AI 訂正解析」。

## 本機執行

```bash
pnpm install
pnpm run dev
```

Production build：

```bash
pnpm run build
```

## Phase 1 執行流程

Phase 1 只處理：

```text
115 年第一次
醫學分子檢驗學與臨床鏡檢學（包括寄生蟲學）
```

執行：

```bash
python scripts/parse_exam_pdfs.py --input "C:\Users\t1600\Desktop\醫檢師國考題" --phase 115-1-03
python scripts/normalize_questions.py --input data/questions_master.json --output data/questions_master.json
python scripts/validate_question_bank.py --input data/questions_master.json --output data/question_bank_validation_report.json
python scripts/generate_ai_tutor_cache.py --input data/questions_master.json --output data/ai_tutor_cache.json
python scripts/export_teacher_review_csv.py --questions data/questions_master.json --cache data/ai_tutor_cache.json --output data/teacher_review_template.csv
python scripts/validate_ai_tutor_cache.py --questions data/questions_master.json --input data/ai_tutor_cache.json --output data/validation_report.json
```

輸出檔案：

```text
data/questions_master.json
data/answer_key_master.json
data/ai_tutor_cache.json
data/ai_tutor_reviewed.json
data/validation_report.json
data/ai_generation_report.json
data/teacher_review_template.csv
data/parse_report.json
data/question_stats.json
data/image_questions.json
data/missing_answers.json
data/manual_review_questions.json
```

## AI 訂正小老師

前端顯示優先順序：

1. `data/ai_tutor_reviewed.json`
2. `data/ai_tutor_cache.json` 中的 `ai_full_text`
3. 「此題尚未建立完整 AI 訂正解析」

若本機沒有 `OPENAI_API_KEY`，`generate_ai_tutor_cache.py` 會產生待補模板，不會編造真正詳解。

教師審核流程：

```bash
python scripts/export_teacher_review_csv.py --questions data/questions_master.json --cache data/ai_tutor_cache.json --output data/teacher_review_template.csv
python scripts/import_teacher_review_csv.py --csv data/teacher_review_template.csv --output data/ai_tutor_reviewed.json
```

CSV 欄位：

```text
question_id,subject,topic,question_text,correct_answer,ai_full_text,teacher_full_text,review_status,reviewer,reviewed_at,note
```

## 錯題本與弱點分析

資料只存在使用者瀏覽器 localStorage：

```text
medtech_exam_wrongbook_v1
medtech_exam_attempts_v1
```

答錯題會自動加入錯題本；一律給分題不列入錯題統計。弱點分析會依作答紀錄計算總答題數、正確率、各科正確率、最常錯 topic 與推薦複習主題。

## 分階段擴充

Phase 2：115 年全部六科

```bash
python scripts/parse_exam_pdfs.py --input "C:\Users\t1600\Desktop\醫檢師國考題" --phase 115-1-all
python scripts/generate_ai_tutor_cache.py --input data/questions_master.json --output data/ai_tutor_cache.json --force
python scripts/export_teacher_review_csv.py --questions data/questions_master.json --cache data/ai_tutor_cache.json --output data/teacher_review_template.csv
python scripts/validate_ai_tutor_cache.py --questions data/questions_master.json --input data/ai_tutor_cache.json --output data/validation_report.json
```

Phase 3：110–115 年全部題目

```bash
python scripts/parse_exam_pdfs.py --input "C:\Users\t1600\Desktop\醫檢師國考題" --phase 110-115-all
python scripts/generate_ai_tutor_cache.py --input data/questions_master.json --output data/ai_tutor_cache.json --force
python scripts/export_teacher_review_csv.py --questions data/questions_master.json --cache data/ai_tutor_cache.json --output data/teacher_review_template.csv
python scripts/validate_ai_tutor_cache.py --questions data/questions_master.json --input data/ai_tutor_cache.json --output data/validation_report.json
```

## GitHub Pages 部署

```bash
git add .
git commit -m "Add pre-generated AI tutor database for medtech exam"
git push
```

`.github/workflows/pages.yml` 會在 push 到 `main` 時自動 build 並部署 GitHub Pages。
