import { ArrowLeft, CheckCircle2, ImageIcon } from 'lucide-react';
import type { Question, UserAnswer } from '../types';
import { getQuestionAssetUrl } from '../lib/assets';
import { getSourceLabel } from '../lib/source';

interface QuizProps {
  subjectName: string;
  questions: Question[];
  answers: UserAnswer[];
  onAnswer: (questionId: string, answer: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function Quiz({ subjectName, questions, answers, onAnswer, onSubmit, onBack }: QuizProps) {
  const answeredCount = answers.filter((answer) => answer.answer).length;

  return (
    <main className="min-h-screen bg-paper">
      <div className="sticky top-0 z-10 border-b border-stone-300 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onBack}
            className="focus-ring grid size-10 shrink-0 place-items-center rounded bg-white text-ink shadow-sm"
            aria-label="返回首頁"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-stone-600 sm:text-sm">{subjectName}</p>
            <h1 className="truncate text-lg font-semibold text-ink sm:text-xl">20 題隨機練習</h1>
          </div>
          <div className="shrink-0 rounded bg-white px-3 py-2 text-right text-xs text-stone-600 shadow-sm sm:text-sm">
            <span className="block font-semibold text-ink">
              {answeredCount} / {questions.length}
            </span>
            已作答
          </div>
        </div>
      </div>

      <form
        className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 pb-24 sm:gap-5 sm:px-6 sm:py-6 sm:pb-28"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {questions.map((question, index) => {
          const selected = answers.find((answer) => answer.questionId === question.id)?.answer || '';
          return (
            <article key={question.id} className="rounded border border-stone-300 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span className="rounded bg-stone-100 px-2 py-1">第 {index + 1} 題</span>
                <span className="rounded bg-emerald-50 px-2 py-1 leading-6 text-emerald-900">
                  出處：{getSourceLabel(question)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-lg leading-8 text-ink sm:text-xl sm:leading-9">{question.stem}</p>
              {question.has_image && question.image_paths.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {question.image_paths.map((imagePath) => (
                    <img
                      key={imagePath}
                      src={getQuestionAssetUrl(imagePath)}
                      alt={`第 ${question.question_number} 題圖片`}
                      className="max-h-[70vh] w-full rounded border border-stone-300 object-contain"
                    />
                  ))}
                </div>
              ) : question.has_image ? (
                <div className="mt-4 flex items-start gap-2 rounded border border-dashed border-stone-300 px-3 py-3 text-sm leading-6 text-stone-600">
                  <ImageIcon className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                  此題標示為圖片題，但目前沒有擷取到圖片。
                </div>
              ) : null}
              <fieldset className="mt-5 grid gap-3">
                <legend className="sr-only">選擇答案</legend>
                {question.options.map((option) => (
                  <label
                    key={option.label}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 rounded border px-3 py-3 transition sm:px-4 ${
                      selected === option.label ? 'border-sea bg-teal-50' : 'border-stone-300 bg-white hover:border-stone-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.label}
                      checked={selected === option.label}
                      onChange={() => onAnswer(question.id, option.label)}
                      className="mt-1 size-4 shrink-0 accent-sea"
                    />
                    <span className="shrink-0 font-semibold text-ink">{option.label}</span>
                    <span className="min-w-0 break-words leading-7 text-stone-800">{option.text}</span>
                  </label>
                ))}
              </fieldset>
            </article>
          );
        })}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-300 bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl justify-end">
            <button
              type="submit"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded bg-sea px-5 py-3 font-semibold text-white shadow-lg hover:bg-teal-800 sm:w-auto"
            >
              <CheckCircle2 size={20} aria-hidden="true" />
              對答案
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
