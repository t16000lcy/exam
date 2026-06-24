import type { AiTutorContent, Question } from '../types';
import { getCorrectAnswerText, getQuestionId, inferTopic, requiresImage } from './questionMeta';

export type AiTutorMode = 'explain';

type AiTutorCache = Record<string, AiTutorContent>;

let cachePromise: Promise<AiTutorCache> | null = null;

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

  const cached = await loadTutorCache();
  const content = cached[getQuestionId(question)] || question.ai_tutor || buildTemplateTutor(question);
  return formatTutorContent(question, studentAnswer, content, mode);
}

export function getTutorStatusLabel(content?: AiTutorContent) {
  if (!content) return '解題資料庫，建議教師校對';
  if (content?.teacher_review_status === 'reviewed') return '教師審核版';
  if (content?.generated_source === 'docx') return '解題資料庫，建議教師校對';
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
  if (mode === 'explain' && content.ai_full_text) {
    return [formatQuestionBlock(question), stripPracticeSection(content.ai_full_text), formatPracticeBlock(question)].join('\n');
  }

  return [
    '尚未產生完整 AI 詳解；以下為依官方答案、題幹與選項建立的模板草稿。',
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
    formatPracticeBlock(question),
  ].join('\n');
}

function stripPracticeSection(text: string) {
  const practiceStart = text.search(/【再練習[^】]*】/);
  return (practiceStart >= 0 ? text.slice(0, practiceStart) : text).trim();
}

function formatQuestionBlock(question: Question) {
  return [
    `題目：${question.question_text || question.stem}`,
    ...question.options.map((option) => `${option.label}. ${option.text}`),
    '',
  ].join('\n');
}

function formatPracticeBlock(question: Question) {
  const optionLabels = ['A', 'B', 'C', 'D'] as const;
  const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
  return [
    '【再練習】',
    '請遮住上方解析，將同一題的選項順序打亂後再作答一次。',
    `題目：${question.question_text || question.stem}`,
    ...shuffledOptions.map((option, index) => `${optionLabels[index]}. ${option.text}`),
    '本區不提供答案；作答後請回到上方解析比對自己的判斷理由。',
  ].join('\n');
}
