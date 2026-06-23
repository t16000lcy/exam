export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (request.method !== "POST") {
      return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
    }

    if (!env.OPENAI_API_KEY) {
      return withCors(Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 }));
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return withCors(Response.json({ error: "Invalid JSON body" }, { status: 400 }));
    }

    const question = payload.question || {};
    const userAnswer = payload.user_answer || "未作答";
    const correctAnswer =
      question.answer_type === "all_credit" ? "一律給分" : (question.answer || []).join(" 或 ");
    const options = (question.options || []).map((item) => `${item.label}. ${item.text}`).join("\n");

    const prompt = [
      "你是醫檢師國考解題老師。請用繁體中文回答。",
      "請說明：",
      "1. 正確答案為什麼正確。",
      "2. 相關醫檢、血液、微生物、免疫、生化、生理或病理學理。",
      "3. 使用者答案或其他選項為什麼不適合。",
      "4. 用適合考生複習的精簡段落，不要只重述答案。",
      "",
      `出處：${question.source_label || ""}`,
      `題幹：${question.stem || ""}`,
      `選項：\n${options}`,
      `使用者答案：${userAnswer}`,
      `正確答案：${correctAnswer}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return withCors(Response.json({ error: "OpenAI request failed", detail }, { status: 502 }));
    }

    const data = await response.json();
    const explanation =
      data.output_text ||
      data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") ||
      "AI 未回傳解說內容。";

    return withCors(Response.json({ explanation }));
  },
};

function withCors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
