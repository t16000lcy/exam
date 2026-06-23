from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def text(value: str) -> str:
    return value


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self._headers()
        self.wfile.write(b"{}")

    def do_GET(self) -> None:
        self._headers()
        self.wfile.write(json.dumps({"ok": True, "service": "mock-ai"}).encode("utf-8"))

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            question = payload.get("question", {})
            user_answer = payload.get("user_answer", "未作答")
            correct = " 或 ".join(question.get("answer", [])) or "一律給分"
            options = "\n".join(
                f"{item.get('label', '')}. {item.get('text', '')}"
                for item in question.get("options", [])
            )
            explanation = "\n".join(
                [
                    "本機 mock AI 解題服務已啟用。",
                    "",
                    f"出處：{question.get('source_label', '未標示')}",
                    f"你的答案：{user_answer}",
                    f"正確答案：{correct}",
                    "",
                    "題目選項：",
                    options,
                    "",
                    "這是單機 mock API 回覆，用來確認前端可以成功呼叫外部解題服務。",
                    "正式部署時，請將 VITE_AI_EXPLAIN_API_URL 改成 Cloudflare Worker 或 Vercel Function URL。",
                ]
            )
            body = json.dumps({"explanation": explanation}, ensure_ascii=False).encode("utf-8")
            self._headers()
            self.wfile.write(body)
        except Exception as exc:
            body = json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8")
            self._headers(500)
            self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8787), Handler)
    print("Mock AI API running at http://127.0.0.1:8787/explain", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
