export default async function handler(request, response) {
  setCors(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    return;
  }

  const question = request.body?.question || {};
  const userAnswer = request.body?.user_answer || '未作答';
  const correctAnswer =
    question.answer_type === 'all_credit' ? '一律給分' : (question.answer || []).join(' 或 ');
  const options = (question.options || []).map((item) => `${item.label}. ${item.text}`).join('\n');

  const prompt = [
    '你是醫檢師國考解題老師。請用繁體中文回答。',
    '請說明：',
    '1. 正確答案為什麼正確。',
    '2. 相關醫檢、血液、微生物、免疫、生化、生理或病理學理。',
    '3. 使用者答案或其他選項為什麼不適合。',
    '4. 用適合考生複習的精簡段落，不要只重述答案。',
    '',
    `出處：${question.source_label || ''}`,
    `題幹：${question.stem || ''}`,
    `選項：\n${options}`,
    `使用者答案：${userAnswer}`,
    `正確答案：${correctAnswer}`,
  ].join('\n');

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: prompt,
    }),
  });

  if (!openAiResponse.ok) {
    const detail = await openAiResponse.text();
    response.status(502).json({ error: 'OpenAI request failed', detail });
    return;
  }

  const data = await openAiResponse.json();
  const explanation =
    data.output_text ||
    data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n') ||
    'AI 未回傳解說內容。';

  response.status(200).json({ explanation });
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
