const SYSTEM_PROMPT = `你是醫事檢驗師國考輔導老師，專長為臨床生理學、臨床血液學、血庫學、分子檢驗、臨床鏡檢、寄生蟲學、微生物學、臨床生化、血清免疫與病毒學。

請根據題目、選項、官方答案與學生作答，協助學生訂正。

規則：
1. 使用繁體中文。
2. 回答對象是醫技系學生與準備醫事檢驗師國考者。
3. 不要過度延伸臨床治療，只聚焦國考需要的檢驗學觀念。
4. 若資料不足，不可編造。
5. 若題目需要圖片但未提供圖片內容，請明確寫「本題需搭配原圖判讀」。
6. 若官方答案為一律給分，請說明此題不適合作為自動評分題。
7. 若有教師審核解析 explanation_verified，優先依教師解析補充。
8. 不要產生危險醫療建議。
9. 不要聲稱自己查閱了不存在的參考資料。
10. 請固定輸出指定格式。`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
    if (request.method !== 'POST') return withCors(Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 }));
    if (!env.OPENAI_API_KEY) return withCors(Response.json({ ok: false, error: 'OPENAI_API_KEY is not configured', fallback: true }, { status: 500 }));

    let payload;
    try {
      payload = await request.json();
    } catch {
      return withCors(Response.json({ ok: false, error: 'Invalid JSON body', fallback: true }, { status: 400 }));
    }

    const prompt = buildPrompt(payload);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return withCors(Response.json({ ok: false, error: 'OpenAI request failed', fallback: true }, { status: 502 }));
    }

    const data = await response.json();
    const content =
      data.output_text ||
      data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n') ||
      '';

    return withCors(Response.json({ ok: true, mode: payload.mode || 'explain', content, source: 'ai' }));
  },
};

function buildPrompt(payload) {
  const options = payload.options || {};
  const modeInstruction = {
    hint: 'mode = hint：只提供提示，不可直接講答案。',
    explain: 'mode = explain：提供完整訂正解析，使用指定格式。',
    why_wrong: 'mode = why_wrong：聚焦學生選項為什麼錯，以及如何避免同類錯誤。',
    practice: 'mode = practice：產生一題相同觀念的變化題，含 A-D 選項與答案，但答案預設收合。',
  }[payload.mode || 'explain'];

  return [
    modeInstruction,
    '',
    `question_id: ${payload.question_id || ''}`,
    `subject: ${payload.subject || ''}`,
    `topic: ${payload.topic || ''}`,
    `subtopic: ${payload.subtopic || ''}`,
    `requires_image: ${Boolean(payload.requires_image)}`,
    `question_text: ${payload.question_text || ''}`,
    `A: ${options.A || ''}`,
    `B: ${options.B || ''}`,
    `C: ${options.C || ''}`,
    `D: ${options.D || ''}`,
    `correct_answer: ${payload.corrected_answer || payload.correct_answer || ''}`,
    `student_answer: ${payload.student_answer || '未作答'}`,
    `explanation_verified: ${payload.explanation_verified || ''}`,
    '',
    '固定格式：',
    '【本題考點】',
    '【正確答案】',
    '【為什麼是這個答案】',
    '【選項解析】',
    'A：',
    'B：',
    'C：',
    'D：',
    '【考前記憶句】',
    '【再練習】',
  ].join('\n');
}

function withCors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
