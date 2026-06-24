import type { AttemptRecord, Question, QuizResult, WrongBookItem } from '../types';
import { isCorrect } from './quiz';
import { getCorrectAnswerText, getExamRound, getQuestionId, getSubtopic, inferTopic } from './questionMeta';

export const wrongBookStorageKey = 'medtech_exam_wrongbook_v1';
export const attemptsStorageKey = 'medtech_exam_attempts_v1';

export function loadWrongBook(): WrongBookItem[] {
  return readList(wrongBookStorageKey);
}

export function saveWrongBook(items: WrongBookItem[]) {
  sessionStorage.setItem(wrongBookStorageKey, JSON.stringify(items));
}

export function loadAttempts(): AttemptRecord[] {
  return readList(attemptsStorageKey);
}

export function recordQuizProgress(result: QuizResult) {
  const answerByQuestionId = new Map(result.answers.map((answer) => [answer.questionId, answer.answer]));
  const attempts = loadAttempts();
  const wrongBookById = new Map(loadWrongBook().map((item) => [item.question_id, item]));
  const now = new Date().toISOString();

  result.questions.forEach((question) => {
    const studentAnswer = answerByQuestionId.get(question.id) || '';
    const correct = isCorrect(question, studentAnswer);
    const questionId = getQuestionId(question);
    const correctAnswer = getCorrectAnswerText(question);
    const topic = inferTopic(question);
    const subtopic = getSubtopic(question);

    attempts.push({
      question_id: questionId,
      subject: question.subject,
      topic,
      subtopic,
      student_answer: studentAnswer,
      correct_answer: correctAnswer,
      is_correct: correct,
      timestamp: now,
    });

    if (!correct && question.answer_type !== 'all_credit' && !question.is_all_correct) {
      const existing = wrongBookById.get(questionId);
      wrongBookById.set(questionId, {
        question_id: questionId,
        year: question.year,
        exam_round: getExamRound(question),
        subject: question.subject,
        topic,
        subtopic,
        question_no: question.question_no || question.question_number,
        question_text: question.question_text || question.stem,
        student_answer: studentAnswer,
        correct_answer: correctAnswer,
        timestamp: existing?.timestamp || now,
        review_count: existing?.review_count || 0,
        last_reviewed_at: existing?.last_reviewed_at || '',
        mastered: existing?.mastered || false,
      });
    }
  });

  sessionStorage.setItem(attemptsStorageKey, JSON.stringify(attempts.slice(-2000)));
  saveWrongBook(Array.from(wrongBookById.values()));
}

export function markWrongBookItemMastered(questionId: string, mastered: boolean) {
  saveWrongBook(
    loadWrongBook().map((item) =>
      item.question_id === questionId
        ? { ...item, mastered, review_count: item.review_count + 1, last_reviewed_at: new Date().toISOString() }
        : item,
    ),
  );
}

export function removeWrongBookItem(questionId: string) {
  saveWrongBook(loadWrongBook().filter((item) => item.question_id !== questionId));
}

function readList<T>(key: string): T[] {
  const raw = sessionStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    sessionStorage.removeItem(key);
    return [];
  }
}
