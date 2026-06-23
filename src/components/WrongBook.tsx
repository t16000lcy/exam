import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WrongBookItem } from '../types';
import { loadWrongBook, markWrongBookItemMastered, removeWrongBookItem } from '../lib/progress';

interface WrongBookProps {
  onBackHome: () => void;
}

export function WrongBook({ onBackHome }: WrongBookProps) {
  const [items, setItems] = useState<WrongBookItem[]>(() => loadWrongBook());
  const activeItems = items.filter((item) => !item.mastered);
  const masteredItems = items.filter((item) => item.mastered);
  const bySubject = useMemo(() => countBy(items, (item) => item.subject), [items]);
  const byTopic = useMemo(() => countBy(items, (item) => item.topic || '待分類'), [items]);

  function refresh() {
    setItems(loadWrongBook());
  }

  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <button type="button" onClick={onBackHome} className="focus-ring inline-flex w-fit items-center gap-2 rounded bg-white px-3 py-2 text-ink shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          回首頁
        </button>

        <header className="rounded border border-stone-300 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm leading-6 text-stone-600">localStorage：medtech_exam_wrongbook_v1</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">錯題本</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="錯題總數" value={items.length} />
            <Metric label="尚未複習" value={activeItems.length} />
            <Metric label="已掌握" value={masteredItems.length} />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <StatList title="依科目統計" rows={bySubject} />
          <StatList title="依 topic 統計" rows={byTopic} />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-ink">最近錯題</h2>
          {items.length === 0 ? (
            <p className="rounded border border-stone-300 bg-white p-4 text-stone-700">目前沒有錯題。答錯題目後會自動加入這裡。</p>
          ) : null}
          {items
            .slice()
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .map((item) => (
              <article key={item.question_id} className="rounded border border-stone-300 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-stone-100 px-2 py-1 text-stone-700">
                    {item.year}年{item.exam_round} 第 {item.question_no} 題
                  </span>
                  <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-900">{item.subject}</span>
                  <span className="rounded bg-sky-50 px-2 py-1 text-sky-900">{item.topic || '待分類'}</span>
                  {item.mastered ? <span className="rounded bg-teal-50 px-2 py-1 text-teal-900">已掌握</span> : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-ink">{item.question_text}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <AnswerLine label="你的答案" value={item.student_answer || '未作答'} />
                  <AnswerLine label="正確答案" value={item.correct_answer} />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      markWrongBookItemMastered(item.question_id, !item.mastered);
                      refresh();
                    }}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:border-sea"
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {item.mastered ? '取消已掌握' : '標記已掌握'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeWrongBookItem(item.question_id);
                      refresh();
                    }}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    從錯題本移除
                  </button>
                </div>
              </article>
            ))}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3">
      <span className="block text-sm text-stone-600">{label}</span>
      <span className="mt-1 block text-3xl font-semibold text-ink">{value}</span>
    </div>
  );
}

function StatList({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <section className="rounded border border-stone-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3 grid gap-2">
        {rows.length === 0 ? <p className="text-sm text-stone-600">尚無資料</p> : null}
        {rows.slice(0, 8).map(([label, count]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded bg-stone-50 px-3 py-2 text-sm">
            <span className="min-w-0 break-words text-stone-700">{label}</span>
            <span className="shrink-0 font-semibold text-ink">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnswerLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-3 py-2">
      <span className="mr-2 text-stone-600">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(getKey(item), (counts.get(getKey(item)) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}
