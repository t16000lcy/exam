import type { AiTutorContent, Question } from '../types';
import { getCorrectAnswerText, getQuestionId, inferTopic, requiresImage } from './questionMeta';

export type AiTutorMode = 'hint' | 'explain' | 'why_wrong' | 'practice';

type AiTutorCache = Record<string, AiTutorContent>;

let cachePromise: Promise<AiTutorCache> | null = null;
let reviewedPromise: Promise<AiTutorCache> | null = null;

export async function requestTutorContent(question: Question, studentAnswer: string, mode: AiTutorMode) {
  const apiUrl = (import.meta.env.VITE_AI_TUTOR_API_URL as string | undefined)?.trim();
  if (apiUrl && apiUrl !== 'mock') {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTutorPayload(question, studentAnswer, mode)),
      });
      if (response.ok) {
        const data = (await response.json()) as { content?: string; ok?: boolean };
        if (data.content) return data.content;
      }
    } catch {
      // Fall through to local cache/template.
    }
  }

  const questionId = getQuestionId(question);
  const reviewed = await loadReviewedTutorCache();
  const cached = await loadTutorCache();
  const content = reviewed[questionId] || cached[questionId] || question.ai_tutor || buildTemplateTutor(question);
  return formatTutorContent(question, studentAnswer, content, mode);
}

export function getTutorStatusLabel(content?: AiTutorContent) {
  if (content?.teacher_review_status === 'reviewed') return '教師審核版';
  if (content?.generated_source === 'ai' || content?.ai_full_text) return 'AI 逐題生成，建議教師確認';
  return 'AI 草稿，建議教師確認';
}

function buildTutorPayload(question: Question, studentAnswer: string, mode: AiTutorMode) {
  return {
    mode,
    question_id: getQuestionId(question),
    question_text: question.question_text || question.stem,
    options: Object.fromEntries(question.options.map((option) => [option.label, option.text])),
    correct_answer: getCorrectAnswerText(question),
    corrected_answer: question.corrected_answer || '',
    student_answer: studentAnswer,
    subject: question.subject,
    topic: inferTopic(question),
    subtopic: question.subtopic || '',
    requires_image: requiresImage(question),
    explanation_verified: question.explanation_verified || '',
  };
}

function loadTutorCache() {
  if (!cachePromise) {
    cachePromise = fetch(`${import.meta.env.BASE_URL}data/ai_tutor_cache.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return cachePromise;
}

function loadReviewedTutorCache() {
  if (!reviewedPromise) {
    reviewedPromise = fetch(`${import.meta.env.BASE_URL}data/ai_tutor_reviewed.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return reviewedPromise;
}

function buildTemplateTutor(question: Question): AiTutorContent {
  const correctAnswer = getCorrectAnswerText(question);
  const optionAnalysis = Object.fromEntries(
    question.options.map((option) => [
      option.label,
      question.answer.includes(option.label) ? '此選項為題庫標示答案之一。' : '此選項需依題幹條件與正確答案比較判斷。',
    ]),
  ) as AiTutorContent['option_analysis'];

  return {
    core_concept: inferTopic(question) === '待分類' ? '本題需依題幹判斷主要考點。' : `本題主要考 ${inferTopic(question)}。`,
    correct_answer_text: `正確答案是：${correctAnswer}`,
    why_correct: requiresImage(question)
      ? '本題需搭配原圖判讀；目前本地快取不硬猜圖片內容。'
      : '目前尚未有教師審核解析，請先依題幹、選項與官方答案整理判斷依據。',
    option_analysis: optionAnalysis,
    memory_sentence: requiresImage(question) ? '圖片題先看圖像關鍵，再回到題幹條件比對選項。' : '先抓題幹關鍵字，再用官方答案回推考點。',
    practice_question: '請用同一考點重新整理一題變化題，並確認每個選項的判斷理由。',
    practice_options: { A: '', B: '', C: '', D: '' },
    practice_answer: '',
    teacher_review_status: 'unreviewed',
  };
}

function formatTutorContent(question: Question, studentAnswer: string, content: AiTutorContent, mode: AiTutorMode) {
  const correctAnswer = getCorrectAnswerText(question);
  const hasFullExplanation =
    Boolean(content.ai_full_text) && (content.generated_source === 'ai' || content.review_status === 'reviewed' || content.teacher_review_status === 'reviewed');
  if (mode === 'explain' && hasFullExplanation) {
    return content.ai_full_text || '';
  }

  if (mode === 'hint') {
    return [
      '【加入錯題本】',
      '若本題答錯，系統已在送出測驗時自動加入錯題本。',
      '你可以回首頁進入「錯題本」查看、標記已掌握或移除。',
    ].join('\n');
  }

  if (mode === 'why_wrong') {
    return [
      '【為什麼我選錯？】',
      `你選的是：${studentAnswer || '未作答'}`,
      `正確答案是：${correctAnswer}`,
      content.why_correct || '請比較你的選項與正確答案在題幹條件上的差異。',
      requiresImage(question) ? '本題需搭配原圖判讀，未提供圖像細節時不應硬猜。' : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (mode === 'practice') {
    return [
      '【再練習】',
      content.practice_question || '請用同一觀念再練一題。',
      content.practice_options.A ? `A：${content.practice_options.A}` : '',
      content.practice_options.B ? `B：${content.practice_options.B}` : '',
      content.practice_options.C ? `C：${content.practice_options.C}` : '',
      content.practice_options.D ? `D：${content.practice_options.D}` : '',
      content.practice_answer ? `答案：${content.practice_answer}` : '答案：請先自行作答，再回頭比對本題考點。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '此題尚未建立完整 AI 訂正解析。',
    '以下僅顯示依官方答案、題幹與選項建立的待補草稿。',
    '',
    '【本題考點】',
    content.core_concept || inferTopic(question),
    '',
    '【正確答案】',
    content.correct_answer_text || `正確答案是：${correctAnswer}`,
    '',
    '【為什麼是這個答案】',
    content.why_correct || (requiresImage(question) ? '本題需搭配原圖判讀。' : '請依題幹條件與官方答案整理判斷。'),
    '',
    '【選項解析】',
    `A：${content.option_analysis.A || ''}`,
    `B：${content.option_analysis.B || ''}`,
    `C：${content.option_analysis.C || ''}`,
    `D：${content.option_analysis.D || ''}`,
    '',
    '【考前記憶句】',
    content.memory_sentence || '題幹關鍵字決定考點，選項需逐一排除。',
    '',
    '【再練習】',
    content.practice_question || '請學生回答一題相同觀念的變化題。',
  ].join('\n');
}
