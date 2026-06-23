import { BookOpenCheck, RotateCcw } from 'lucide-react';
import type { QuizResult, SubjectSlug } from '../types';
import { subjects } from '../lib/subjects';

interface HomeProps {
  lastResult: QuizResult | null;
  onStart: (slug: SubjectSlug) => void;
  onOpenLast: () => void;
}

export function Home({ lastResult, onStart, onOpenLast }: HomeProps) {
  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-5 border-b border-stone-300 pb-5 sm:flex-row sm:items-start sm:justify-between sm:pb-7">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded bg-sea text-white sm:size-12">
              <BookOpenCheck size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600 sm:text-sm">
                Medical Laboratory Scientist Exam Practice
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight text-ink sm:text-4xl">醫檢師國考題練習網站</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700 sm:text-base">
                選擇科目後會隨機抽出 20 題練習，送出後可查看分數、正確答案、答錯答案與最近一次測驗紀錄。
              </p>
            </div>
          </div>
        </div>

        {lastResult ? (
          <button
            type="button"
            onClick={onOpenLast}
            className="focus-ring flex w-full flex-col gap-3 rounded border border-stone-300 bg-white px-4 py-4 text-left shadow-sm transition hover:border-sea sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0">
              <span className="block text-sm text-stone-600">最近一次測驗</span>
              <span className="mt-1 block break-words font-medium leading-7 text-ink">
                {lastResult.subject}，{lastResult.score} 分，錯 {lastResult.wrongCount} 題
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-sea">
              重新查看
              <RotateCcw size={18} aria-hidden="true" />
            </span>
          </button>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <button
              key={subject.slug}
              type="button"
              onClick={() => onStart(subject.slug)}
              className={`focus-ring flex min-h-36 flex-col justify-between rounded border border-stone-200 border-l-4 ${subject.accent} p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-44 sm:p-5`}
            >
              <span className="text-sm font-medium text-stone-600">{subject.shortName}</span>
              <span className="mt-3 block text-xl font-semibold leading-8 text-ink sm:text-2xl">{subject.name}</span>
              <span className="mt-5 inline-flex w-fit rounded bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm">
                開始 20 題練習
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
