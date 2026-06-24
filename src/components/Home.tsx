import { BarChart3, BookOpenCheck, ClipboardList, ExternalLink, RotateCcw } from 'lucide-react';
import type { QuestionManifest, QuizMode, QuizResult, SubjectSlug } from '../types';
import { subjects } from '../lib/subjects';

interface HomeProps {
  lastResult: QuizResult | null;
  manifest: QuestionManifest | null;
  wrongBookCount: number;
  overallAccuracy: number | null;
  onStart: (slug: SubjectSlug, mode: QuizMode) => void;
  onOpenLast: () => void;
  onOpenWrongBook: () => void;
  onOpenWeakAnalysis: () => void;
}

export function Home({ lastResult, manifest, wrongBookCount, overallAccuracy, onStart, onOpenLast, onOpenWrongBook, onOpenWeakAnalysis }: HomeProps) {
  const availableSubjects = subjects.filter((subject) => !manifest || (manifest.subject_counts[subject.slug] || 0) > 0);
  const rangeText = manifest
    ? `國考題範圍：${manifest.range_text}，共${manifest.total_questions}題`
    : '國考題範圍：110–115 年全部題目，共5280題';

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
                選擇科目後可進行練習模式或模擬考模式，送出後一次查看分數、正確答案、答錯答案與訂正解析。
              </p>
              <p className="mt-2 text-sm font-medium leading-7 text-sea sm:text-base">
                {rangeText}
              </p>
              <a
                href="https://wwwc.moex.gov.tw/main/home/wfrmHome.aspx"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-sea hover:text-sea"
              >
                考選部考試專區
                <ExternalLink size={16} aria-hidden="true" />
              </a>
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

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={onOpenWrongBook}
            className="focus-ring flex items-center justify-between gap-3 rounded border border-stone-300 bg-white px-4 py-4 text-left shadow-sm transition hover:border-sea"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <ClipboardList size={18} aria-hidden="true" />
                錯題本
              </span>
              <span className="mt-1 block text-sm leading-6 text-stone-600">查看錯題、標記已掌握、依科目與 topic 統計。</span>
            </span>
            <span className="shrink-0 rounded bg-red-50 px-3 py-1 text-sm font-semibold text-red-900">{wrongBookCount}</span>
          </button>

          <button
            type="button"
            onClick={onOpenWeakAnalysis}
            className="focus-ring flex items-center justify-between gap-3 rounded border border-stone-300 bg-white px-4 py-4 text-left shadow-sm transition hover:border-sea"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <BarChart3 size={18} aria-hidden="true" />
                弱點分析
              </span>
              <span className="mt-1 block text-sm leading-6 text-stone-600">依作答紀錄分析正確率與最常錯主題。</span>
            </span>
            <span className="shrink-0 rounded bg-teal-50 px-3 py-1 text-sm font-semibold text-sea">
              {overallAccuracy === null ? '尚無' : `${overallAccuracy}%`}
            </span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {availableSubjects.map((subject) => (
            <div
              key={subject.slug}
              className={`flex min-h-44 flex-col justify-between rounded border border-stone-200 border-l-4 ${subject.accent} bg-white p-4 text-left shadow-sm sm:p-5`}
            >
              <span className="text-sm font-medium text-stone-600">{subject.shortName}</span>
              <span className="mt-3 block text-xl font-semibold leading-8 text-ink sm:text-2xl">{subject.name}</span>
              <span className="mt-2 text-sm text-stone-600">
                {manifest ? `本階段 ${manifest.subject_counts[subject.slug] || 0} 題` : '題庫載入中'}
              </span>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onStart(subject.slug, 'practice')}
                  className="focus-ring rounded bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 transition hover:ring-sea"
                >
                  練習 20 題
                  <span className="mt-1 block text-xs font-normal text-stone-500">15 分鐘</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStart(subject.slug, 'mock')}
                  className="focus-ring rounded bg-sea px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                >
                  模擬考 80 題
                  <span className="mt-1 block text-xs font-normal text-teal-50">60 分鐘</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
