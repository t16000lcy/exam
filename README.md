# 醫檢師國考題練習網站

Vite + React + TypeScript + Tailwind CSS 製作的靜態題庫練習網站，可部署到 GitHub Pages。

## 本機執行

```bash
pnpm install
pnpm run dev
```

## 題庫檔案

網站支援兩種模式：

### 1. GitHub Actions 從 Google Drive 產生題庫

目前預設使用這個 Google Drive folder：

```text
https://drive.google.com/drive/folders/1e1YhzGE6YeT1rKArT_hStA1uiV_Td9mo?usp=sharing
```

部署時 GitHub Actions 會執行：

```bash
python scripts/sync_drive.py
python scripts/extract_questions.py
python scripts/extract_answers.py
python scripts/merge_question_answer.py
python scripts/validate_question_bank.py
pnpm run build
```

因此 repo 可以不提交 `data/questions/` 與 `public/question-assets/`，但部署出來的 GitHub Pages artifact 仍會包含題庫 JSON 與圖片。

### 2. 題庫放在 GitHub Pages repo

保留並上傳：

```text
data/questions/*.json
public/question-assets/
```

這是最簡單、最穩定的模式。

### 3. 題庫放在外部靜態檔案空間

若不想把題庫 JSON 和圖片放到 GitHub，可設定：

```text
VITE_QUESTION_DATA_BASE_URL=https://your-static-host.example.com/questions
VITE_QUESTION_ASSET_BASE_URL=https://your-static-host.example.com
```

前端會讀取：

```text
https://your-static-host.example.com/questions/clinical-physiology-pathology.json
https://your-static-host.example.com/question-assets/110/1/example.png
```

注意：Google Drive「資料夾分享連結」通常不能直接給瀏覽器 `fetch()` 當題庫 API 使用，常見原因是 CORS、確認下載頁、檔案 ID 轉址、流量限制。若要走外部題庫，建議使用可公開直連且支援 CORS 的靜態檔案服務，例如 Google Cloud Storage、Cloudflare R2、Firebase Hosting、Supabase Storage，或另一個專門放資料的 GitHub Pages repo。

## AI 解題 API

前端不放 OpenAI API key。正式部署時請設定：

```text
VITE_AI_EXPLAIN_API_URL=https://your-api.example.com/explain
```

本機測試可使用：

```text
VITE_AI_EXPLAIN_API_URL=mock
```

## Parser

```bash
pip install -r requirements.txt
python scripts/sync_drive.py
python scripts/extract_questions.py
python scripts/extract_answers.py
python scripts/merge_question_answer.py
python scripts/validate_question_bank.py
```

輸出：

```text
data/questions/{subject_slug}.json
public/question-assets/{year}/{exam_code}/
data/parse_report.json
```

## GitHub Pages

`.github/workflows/pages.yml` 會在 push 到 `main` 時自動 build 並部署 GitHub Pages，也支援手動執行 parser。

若採外部題庫模式，GitHub repo 可以不提交：

```text
data/questions/
public/question-assets/
uploads/
```

但必須在 GitHub Actions 或 build 環境設定：

```text
VITE_QUESTION_DATA_BASE_URL
VITE_QUESTION_ASSET_BASE_URL
```

否則上線後會讀不到題庫。

## Drive 權限

若使用 `scripts/sync_drive.py` 從 Google Drive 下載 PDF，請將 Drive folder 權限設為「知道連結的人可檢視」。若無法下載，請確認資料夾與 PDF 都有公開檢視權限。
