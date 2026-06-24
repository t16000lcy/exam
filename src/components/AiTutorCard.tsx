import { Bot, Lightbulb, MessageCircleQuestion, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { AiTutorContent, Question } from '../types';
import { type AiTutorMode, getTutorStatusLabel, requestTutorContent } from '../lib/aiTutor';

interface AiTutorCardProps {
  question: Question;
  studentAnswer: string;
  correct: boolean;
}

const modes: Array<{ mode: AiTutorMode; label: string; icon: typeof Lightbulb }> = [
  { mode: 'explain', label: '查看完整訂正', icon: Wand2 },
  { mode: 'why_wrong', label: '為什麼我選錯？', icon: MessageCircleQuestion },
  { mode: 'practice', label: '同觀念再練習', icon: Sparkles },
  { mode: 'hint', label: '加入錯題本', icon: Lightbulb },
];

export function AiTutorCard({ question, studentAnswer, correct }: AiTutorCardProps) {
  const [activeMode, setActiveMode] = useState<AiTutorMode>(correct ? 'explain' : 'hint');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const tutor = question.ai_tutor as AiTutorContent | undefined;

  async function run(mode: AiTutorMode) {
    setActiveMode(mode);
    setLoading(true);
    try {
      const nextContent = await requestTutorContent(question, studentAnswer, mode);
      setContent(nextContent);
    } catch (caught) {
      setContent(caught instanceof Error ? caught.message : 'AI 訂正小老師暫時無法回應。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-4 rounded border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-ink">
            <Bot size={18} aria-hidden="true" />
            醫檢國考 AI 訂正小老師
          </h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">依據官方答案與本題內容產生，教師審核版優先顯示。</p>
        </div>
        <span className="w-fit rounded bg-white px-2 py-1 text-xs font-medium text-sea shadow-sm">{getTutorStatusLabel(tutor)}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => run(mode)}
            className={`focus-ring inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
              activeMode === mode ? 'border-sea bg-sea text-white' : 'border-stone-300 bg-white text-ink hover:border-sea'
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-4 text-sm text-stone-600">產生訂正內容中...</p> : null}
      {content ? (
        <div className="mt-4 whitespace-pre-wrap break-words rounded border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-800 sm:text-base">
          {content}
        </div>
      ) : (
        <p className="mt-4 rounded border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-sm leading-6 text-stone-700">
          {correct ? '答對了，可以按「幫我訂正這題」整理考前重點。' : '答錯題會自動加入錯題本；請先按一個按鈕開始訂正。'}
        </p>
      )}
    </section>
  );
}
