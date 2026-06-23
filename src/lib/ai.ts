import type { Question } from '../types';
import { getSourceLabel } from './source';

export interface AiExplanation {
  explanation: string;
}

export async function requestExplanation(question: Question, userAnswer: string) {
  const apiUrl = (import.meta.env.VITE_AI_EXPLAIN_API_URL as string | undefined)?.trim();
  if (!apiUrl) {
    throw new Error('尚未啟用 AI 解題服務');
  }

  if (apiUrl === 'mock') {
    return buildMockExplanation(question, userAnswer);
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      user_answer: userAnswer,
      instruction:
        '請用繁體中文解釋醫檢師國考題。請說明正確答案為什麼成立、相關學理、使用者答案為何不適合，並保持簡潔清楚。',
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 解題服務回應失敗：${response.status}`);
  }

  const data = (await response.json()) as Partial<AiExplanation>;
  return data.explanation || 'AI 解題服務沒有回傳說明內容。';
}

function buildMockExplanation(question: Question, userAnswer: string) {
  const correctAnswer = question.answer_type === 'all_credit' ? '一律給分' : question.answer.join(' 或 ');
  const options = question.options.map((option) => `${option.label}. ${option.text}`).join('\n');
  const selected = question.options.find((option) => option.label === userAnswer);
  const correctOptions = question.options.filter((option) => question.answer.includes(option.label));

  return [
    '本機 mock AI 解題服務已啟用。',
    '',
    `出處：${getSourceLabel(question)}`,
    `你的答案：${userAnswer || '未作答'}${selected ? `，${selected.text}` : ''}`,
    `正確答案：${correctAnswer}${correctOptions.length > 0 ? `，${correctOptions.map((option) => option.text).join(' 或 ')}` : ''}`,
    '',
    '為什麼選這個答案？',
    '目前是本機 mock 回覆，用來確認前端 AI 小幫手流程正常。正式串接 OpenAI 後，這裡會改成依照題幹、選項與正確答案產生學理解釋。',
    '',
    '正式 AI 回覆會包含：',
    '1. 正確答案背後的醫檢或基礎醫學原理。',
    '2. 其他選項為什麼不符合題意。',
    '3. 考試常見的判斷關鍵與記憶重點。',
    '',
    userAnswer && !question.answer.includes(userAnswer)
      ? `你選的 ${userAnswer} 不是本題標示答案；正式 AI 會進一步指出它和正確答案在學理上的差異。`
      : '你的答案與題庫答案相符；正式 AI 會補充這個答案成立的原因。',
    '',
    '題目選項：',
    options,
    '',
    '正式部署時，請把 VITE_AI_EXPLAIN_API_URL 改成 Cloudflare Worker 或 Vercel Function URL。',
  ].join('\n');
}
