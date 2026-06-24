import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import { loadAttempts } from '../lib/progress';

interface WeakAnalysisProps {
  onBackHome: () => void;
}

export function WeakAnalysis({ onBackHome }: WeakAnalysisProps) {
  const attempts = loadAttempts();
  const total = attempts.length;
  const wrong = attempts.filter((item) => !item.is_correct).length;
  const accuracy = total === 0 ? 0 : Math.round(((total - wrong) / total) * 100);
  const subjectRows = useMemo(() => accuracyBy(attempts, (item) => item.subject), [attempts]);
  const topicWrongRows = useMemo(
    () =>
      countWrongBy(attempts, (item) => item.topic || '待分類')
        .slice(0, 5),
    [attempts],
  );

  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <button type="button" onClick={onBackHome} className="focus-ring inline-flex w-fit items-center gap-2 rounded bg-white px-3 py-2 text-ink shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          回首頁
        </button>

        <header className="rounded border border-stone-300 bg-white p-4 shadow-sm sm:p-5">
          <p className="inline-flex items-center gap-2 text-sm leading-6 text-stone-600">
            <BarChart3 size={16} aria-hidden="true" />
            本次開啟網頁期間累積；關閉網頁後重新計算。
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">弱點分析</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="答題數" value={total} />
            <Metric label="正確率" value={`${accuracy}%`} />
            <Metric label="錯題數" value={wrong} />
          </div>
        </header>

        <section className="rounded border border-stone-300 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">本次學習摘要</h2>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            共作答 {total} 題，正確率 {accuracy}%，累積錯題 {wrong} 題。
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded border border-stone-300 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">各科正確率</h2>
            <div className="mt-3 grid gap-2">
              {subjectRows.length === 0 ? <p className="text-sm text-stone-600">尚無資料</p> : null}
              {subjectRows.map(([subject, percent]) => (
                <div key={subject} className="rounded bg-stone-50 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0 break-words text-stone-700">{subject}</span>
                    <span className="font-semibold text-ink">{percent}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded bg-stone-200">
                    <div className="h-2 rounded bg-sea" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-stone-300 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">最需要加強的主題</h2>
            <ol className="mt-3 grid gap-2">
              {topicWrongRows.length === 0 ? <p className="text-sm text-stone-600">尚無錯題主題</p> : null}
              {topicWrongRows.map(([topic, count], index) => (
                <li key={topic} className="flex items-center justify-between gap-3 rounded bg-red-50 px-3 py-2 text-sm text-red-950">
                  <span>
                    {index + 1}. {topic}
                  </span>
                  <span className="font-semibold">{count} 題</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="rounded border border-teal-200 bg-teal-50 p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">AI 建議複習順序</h2>
          <div className="mt-3 grid gap-2 text-sm leading-7 text-stone-800">
            <p>第一優先：{topicWrongRows[0]?.[0] || '先完成一回練習，累積作答資料。'}</p>
            <p>第二優先：{topicWrongRows[1]?.[0] || '複習錯題本中尚未掌握的題目。'}</p>
            <p>第三優先：{topicWrongRows[2]?.[0] || '針對低正確率科目再抽 20 題練習。'}</p>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3">
      <span className="block text-sm text-stone-600">{label}</span>
      <span className="mt-1 block text-3xl font-semibold text-ink">{value}</span>
    </div>
  );
}

function accuracyBy<T extends { is_correct: boolean }>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, { total: number; correct: number }>();
  items.forEach((item) => {
    const key = getKey(item);
    const current = grouped.get(key) || { total: 0, correct: 0 };
    current.total += 1;
    current.correct += item.is_correct ? 1 : 0;
    grouped.set(key, current);
  });
  return Array.from(grouped.entries())
    .map(([key, value]) => [key, Math.round((value.correct / value.total) * 100)] as [string, number])
    .sort((a, b) => a[1] - b[1]);
}

function countWrongBy<T extends { is_correct: boolean }>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  items.filter((item) => !item.is_correct).forEach((item) => counts.set(getKey(item), (counts.get(getKey(item)) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}
