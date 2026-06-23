import { ArrowLeft, Bot, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { Question, QuizResult } from '../types';
import { requestExplanation } from '../lib/ai';
import { isCorrect } from '../lib/quiz';
import { getSourceLabel } from '../lib/source';

interface ResultProps {
  result: QuizResult;
  onBackHome: () => void;
  onRetryWrong: (questions: Question[]) => void;
}

export function Result({ result, onBackHome, onRetryWrong }: ResultProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const aiEnabled = Boolean(import.meta.env.VITE_AI_EXPLAIN_API_URL);
  const answerByQuestionId = new Map(result.answers.map((answer) => [answer.questionId, answer.answer]));
  const wrongQuestions = result.questions.filter((question) => !isCorrect(question, answerByQuestionId.get(question.id) || ''));

  async function explain(question: Question, userAnswer: string) {
    if (!aiEnabled) return;
    setLoadingId(question.id);
    try {
      const text = await requestExplanation(question, userAnswer);
      setExplanations((current) => ({ ...current, [question.id]: text }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'AI 解題服務暫時無法回應。';
      setExplanations((current) => ({ ...current, [question.id]: message }));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="focus-ring inline-flex w-fit items-center gap-2 rounded bg-white px-3 py-2 text-ink shadow-sm"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            回首頁
          </button>
          <button
            type="button"
            onClick={() => onRetryWrong(wrongQuestions)}
            disabled={wrongQuestions.length === 0}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <RotateCcw size={16} aria-hidden="true" />
            重練錯題
          </button>
        </div>

        <header className="rounded border border-stone-300 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm leading-6 text-stone-600">{result.subject}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">測驗結果</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="總分" value={`${result.score}`} />
            <Metric label="答對題數" value={`${result.correctCount}`} />
            <Metric label="答錯題數" value={`${result.wrongCount}`} />
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-ink">答題明細</h2>
          {result.questions.map((question, index) => {
            const userAnswer = answerByQuestionId.get(question.id) || '';
            const correct = isCorrect(question, userAnswer);
            const correctAnswer = question.answer_type === 'all_credit' ? '一律給分' : question.answer.join(' 或 ');
            return (
              <article
                key={question.id}
                className={`rounded border bg-white p-4 shadow-sm sm:p-5 ${correct ? 'border-emerald-300' : 'border-red-300'}`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-stone-100 px-2 py-1 text-stone-700">第 {index + 1} 題</span>
                  <span className="rounded bg-emerald-50 px-2 py-1 leading-6 text-emerald-900">
                    出處：{getSourceLabel(question)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium ${
                      correct ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {correct ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                    {correct ? '答對' : '答錯'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-base leading-8 text-ink sm:text-lg">{question.stem}</p>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <AnswerBadge label="正確答案" value={correctAnswer} tone="correct" />
                  <AnswerBadge label={correct ? '你的答案' : '答錯的答案'} value={userAnswer || '未作答'} tone={correct ? 'neutral' : 'wrong'} />
                </div>
                <button
                  type="button"
                  disabled={!aiEnabled || loadingId === question.id}
                  onClick={() => explain(question, userAnswer || '未作答')}
                  className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-ink px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-400 sm:w-auto"
                >
                  <Bot size={16} aria-hidden="true" />
                  {aiEnabled ? (loadingId === question.id ? '解題中...' : 'AI 解題小幫手') : '尚未啟用 AI 解題服務'}
                </button>
                {explanations[question.id] ? (
                  <div className="mt-4 whitespace-pre-wrap break-words rounded border border-stone-300 bg-stone-50 p-4 text-sm leading-7 text-stone-800 sm:text-base">
                    {explanations[question.id]}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3">
      <span className="block text-sm text-stone-600">{label}</span>
      <span className="mt-1 block text-3xl font-semibold text-ink">{value}</span>
    </div>
  );
}

function AnswerBadge({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'correct' | 'wrong' | 'neutral' }) {
  const toneClass =
    tone === 'correct'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'wrong'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-stone-200 bg-stone-50 text-ink';
  return (
    <div className={`rounded border px-3 py-3 ${toneClass}`}>
      <span className="mr-2 text-stone-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
