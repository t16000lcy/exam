import type { Question, QuizResult, UserAnswer } from '../types';
import { getQuestionDataUrl } from './assets';

const resultStorageKey = 'mlt-last-quiz-result';

export function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function pickRandomQuestions(questions: Question[], count = 20) {
  return shuffle(questions).slice(0, Math.min(count, questions.length));
}

export function isCorrect(question: Question, answer: string) {
  if (question.answer_type === 'all_credit') return true;
  if (!answer) return false;
  return question.answer.includes(answer);
}

export function buildResult(
  subjectSlug: QuizResult['subjectSlug'],
  subject: string,
  questions: Question[],
  answers: UserAnswer[],
): QuizResult {
  const correctCount = questions.filter((question) => {
    const answer = answers.find((item) => item.questionId === question.id)?.answer || '';
    return isCorrect(question, answer);
  }).length;
  const wrongCount = questions.length - correctCount;
  const score = questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100);

  return {
    subjectSlug,
    subject,
    submittedAt: new Date().toISOString(),
    questions,
    answers,
    correctCount,
    wrongCount,
    score,
  };
}

export function saveResult(result: QuizResult) {
  localStorage.setItem(resultStorageKey, JSON.stringify(result));
}

export function loadLastResult(): QuizResult | null {
  const raw = localStorage.getItem(resultStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuizResult;
  } catch {
    localStorage.removeItem(resultStorageKey);
    return null;
  }
}

export async function loadQuestions(slug: string): Promise<Question[]> {
  const questionUrl = getQuestionDataUrl(slug);
  const response = await fetch(questionUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`無法讀取題庫：${slug}.json`);
  }
  const questions = (await response.json()) as Question[];
  return questions.sort((a, b) => Number(a.year) - Number(b.year) || a.question_number - b.question_number);
}
