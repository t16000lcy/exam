import type { Question } from '../types';

function normalizeSession(value?: string) {
  if (!value) return '';
  const match = value.match(/\d+/);
  if (!match) return '';
  return String(Number(match[0]));
}

export function getSourceLabel(question: Question) {
  if (question.source_label) return question.source_label;
  const session = normalizeSession(question.exam_session || question.exam_code);
  const year = question.year ? `${question.year} 年` : '';
  const sessionText = session ? `第 ${session} 次` : '';
  const number = question.question_number ? `第 ${question.question_number} 題` : '';
  const exam = [year, sessionText].filter(Boolean).join('');
  const parts = [exam, question.subject, number].filter(Boolean);
  return parts.length > 0 ? parts.join('／') : '出處未標示';
}
