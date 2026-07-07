import { Bot, ExternalLink, Wand2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { AiTutorContent, Question } from '../types';
import { type AiTutorMode, getTutorStatusLabel, requestTutorContent } from '../lib/aiTutor';

interface AiTutorCardProps {
  question: Question;
  studentAnswer: string;
  correct: boolean;
}

export function AiTutorCard({ question, studentAnswer, correct }: AiTutorCardProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const tutor = question.ai_tutor as AiTutorContent | undefined;

  async function run(mode: AiTutorMode) {
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
            醫檢國考課輔AI老師
          </h3>
          <p className="mt-1 text-sm leading-6 text-stone-700">依據題庫解題資料庫顯示本題訂正內容。</p>
        </div>
        <span className="w-fit rounded bg-white px-2 py-1 text-xs font-medium text-sea shadow-sm">{getTutorStatusLabel(tutor)}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => run('explain')}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded border border-sea bg-sea px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 sm:w-auto"
        >
          <Wand2 size={16} aria-hidden="true" />
          醫檢國考課輔AI老師
        </button>
        <ExternalAiLink
          href="https://chatgpt.com/"
          label="ChatGPT"
          icon={<img src="https://chatgpt.com/favicon.ico" alt="" className="size-5 rounded-sm object-contain" />}
        />
        <ExternalAiLink href="https://gemini.google.com/" label="Gemini" icon={<GeminiLogo />} />
      </div>

      {loading ? <p className="mt-4 text-sm text-stone-600">產生訂正內容中...</p> : null}
      {content ? (
        <div className="mt-4 whitespace-pre-wrap break-words rounded border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-800 sm:text-base">
          {content}
        </div>
      ) : (
        <p className="mt-4 rounded border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-sm leading-6 text-stone-700">
          {correct ? '答對了，也可以查看本題重點整理。' : '答錯題會自動加入錯題本；可按上方按鈕查看本題訂正。'}
        </p>
      )}
    </section>
  );
}

function ExternalAiLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-sea hover:text-sea sm:w-auto"
      aria-label={`開啟 ${label}`}
    >
      <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      {label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

function GeminiLogo() {
  return (
    <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
      <defs>
        <linearGradient id="geminiLogoGradient" x1="5" x2="27" y1="27" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34a853" />
          <stop offset="0.35" stopColor="#4285f4" />
          <stop offset="0.68" stopColor="#a142f4" />
          <stop offset="1" stopColor="#fbbc04" />
        </linearGradient>
      </defs>
      <path
        fill="url(#geminiLogoGradient)"
        d="M16 3.5c1.5 6.7 5.8 11 12.5 12.5C21.8 17.5 17.5 21.8 16 28.5 14.5 21.8 10.2 17.5 3.5 16 10.2 14.5 14.5 10.2 16 3.5Z"
      />
    </svg>
  );
}
