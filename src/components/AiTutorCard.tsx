import { Bot, ClipboardPlus, KeyRound, Loader2, RefreshCcw, Sparkles, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { AiTutorContent, MultiAiProvider, MultiAiProviderResult, Question } from '../types';
import { type AiTutorMode, getTutorStatusLabel, requestTutorContent } from '../lib/aiTutor';
import { addQuestionToWrongBook } from '../lib/progress';
import {
  getSessionApiKeys,
  getSessionModels,
  multiAiProviders,
  setSessionApiKeys,
  setSessionModels,
  solveWithMultiAi,
  summarizeMultiAi,
  testProvider,
  type MultiAiApiKeys,
  type MultiAiModels,
} from '../lib/multiAi';

interface AiTutorCardProps {
  question: Question;
  studentAnswer: string;
  correct: boolean;
}

const emptyResults = Object.fromEntries(
  multiAiProviders.map((provider) => [
    provider.id,
    { provider: provider.id, model: provider.defaultModel, status: 'idle', content: '' },
  ]),
) as Record<MultiAiProvider, MultiAiProviderResult>;

export function AiTutorCard({ question, studentAnswer, correct }: AiTutorCardProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [multiError, setMultiError] = useState('');
  const [wrongBookMessage, setWrongBookMessage] = useState('');
  const [results, setResults] = useState<Record<MultiAiProvider, MultiAiProviderResult>>(emptyResults);
  const [summary, setSummary] = useState<MultiAiProviderResult | null>(null);
  const [activeProvider, setActiveProvider] = useState<MultiAiProvider>('openai');
  const [summaryProvider, setSummaryProvider] = useState<MultiAiProvider>('openai');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<MultiAiApiKeys>(() => getSessionApiKeys());
  const [models, setModels] = useState<MultiAiModels>(() => getSessionModels());
  const [testMessages, setTestMessages] = useState<Partial<Record<MultiAiProvider, string>>>({});
  const tutor = question.ai_tutor as AiTutorContent | undefined;

  const resultList = useMemo(() => multiAiProviders.map((provider) => results[provider.id]), [results]);

  async function run(mode: AiTutorMode) {
    setLoading(true);
    try {
      setContent(await requestTutorContent(question, studentAnswer, mode));
    } catch (caught) {
      setContent(caught instanceof Error ? caught.message : 'AI 訂正內容載入失敗。');
    } finally {
      setLoading(false);
    }
  }

  async function runMultiAi() {
    setMultiError('');
    setSummary(null);
    setMultiLoading(true);
    setSessionApiKeys(apiKeys);
    setSessionModels(models);
    setResults(
      Object.fromEntries(
        multiAiProviders.map((provider) => [
          provider.id,
          { provider: provider.id, model: models[provider.id] || provider.defaultModel, status: 'loading', content: '' },
        ]),
      ) as Record<MultiAiProvider, MultiAiProviderResult>,
    );
    try {
      const nextResults = await solveWithMultiAi(question, studentAnswer);
      setResults(toResultMap(nextResults));
    } catch (caught) {
      setMultiError(caught instanceof Error ? caught.message : 'Multi-AI 解題失敗。');
      setResults((current) =>
        mapResults(current, (item) => (item.status === 'loading' ? { ...item, status: 'error', errorMessage: '尚未完成' } : item)),
      );
    } finally {
      setMultiLoading(false);
    }
  }

  async function runSummary() {
    setSummaryLoading(true);
    setSessionApiKeys(apiKeys);
    setSessionModels(models);
    try {
      setSummary(await summarizeMultiAi(question, studentAnswer, resultList, summaryProvider));
    } catch (caught) {
      setSummary({
        provider: summaryProvider,
        model: models[summaryProvider] || '',
        status: 'error',
        content: '',
        errorMessage: caught instanceof Error ? caught.message : '一鍵總結失敗。',
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  function addWrongBook() {
    addQuestionToWrongBook(question, studentAnswer);
    setWrongBookMessage('已加入錯題本');
  }

  async function testOneProvider(provider: MultiAiProvider) {
    setSessionApiKeys(apiKeys);
    setSessionModels(models);
    setTestMessages((current) => ({ ...current, [provider]: '測試中...' }));
    try {
      const result = await testProvider(provider);
      setTestMessages((current) => ({ ...current, [provider]: `連線成功：${result.model}，${result.latencyMs} ms` }));
    } catch (caught) {
      setTestMessages((current) => ({ ...current, [provider]: caught instanceof Error ? caught.message : '連線失敗' }));
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
          <p className="mt-1 text-sm leading-6 text-stone-700">可使用本地解析、Multi-AI 交叉驗證與錯題本輔助訂正。</p>
        </div>
        <span className="w-fit rounded bg-white px-2 py-1 text-xs font-medium text-sea shadow-sm">{getTutorStatusLabel(tutor)}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActionButton onClick={() => run('explain')} disabled={loading} icon={<Wand2 size={16} aria-hidden="true" />} label="醫檢國考課輔AI老師" />
        <ActionButton onClick={runMultiAi} disabled={multiLoading} icon={<Sparkles size={16} aria-hidden="true" />} label="多 AI 解題" />
        <ActionButton onClick={runSummary} disabled={summaryLoading} icon={<RefreshCcw size={16} aria-hidden="true" />} label="一鍵總結" />
        <ActionButton onClick={addWrongBook} icon={<ClipboardPlus size={16} aria-hidden="true" />} label="加入錯題本" />
      </div>

      <button type="button" onClick={() => setSettingsOpen((open) => !open)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-sea">
        <KeyRound size={16} aria-hidden="true" />
        Multi-AI provider 設定
      </button>
      {settingsOpen ? (
        <ProviderSettings
          apiKeys={apiKeys}
          models={models}
          summaryProvider={summaryProvider}
          testMessages={testMessages}
          onApiKeysChange={setApiKeys}
          onModelsChange={setModels}
          onSummaryProviderChange={setSummaryProvider}
          onTest={testOneProvider}
        />
      ) : null}

      {loading || multiLoading || summaryLoading ? <p className="mt-4 text-sm text-stone-600">處理中...</p> : null}
      {wrongBookMessage ? <p className="mt-3 text-sm font-medium text-sea">{wrongBookMessage}</p> : null}
      {multiError ? <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{multiError}</p> : null}

      {content ? <TextPanel content={content} /> : null}
      {hasAnyMultiResult(resultList) ? (
        <MultiAiResults activeProvider={activeProvider} results={resultList} onActiveProviderChange={setActiveProvider} onRetry={runMultiAi} />
      ) : null}
      {summary ? (
        <div className="mt-4">
          <h4 className="text-base font-semibold text-ink">一鍵總結</h4>
          <ProviderCard result={summary} onRetry={runSummary} />
        </div>
      ) : null}

      {!content && !hasAnyMultiResult(resultList) ? (
        <p className="mt-4 rounded border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-sm leading-6 text-stone-700">
          {correct ? '答對也可以查看解析，確認觀念是否穩固。' : '答錯題可用多 AI 交叉驗證，再加入錯題本反覆訂正。'}
        </p>
      ) : null}
    </section>
  );
}

function ActionButton({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded border border-sea bg-white px-3 py-2 text-sm font-medium text-sea hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {disabled ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : icon}
      {label}
    </button>
  );
}

function ProviderSettings(props: {
  apiKeys: MultiAiApiKeys;
  models: MultiAiModels;
  summaryProvider: MultiAiProvider;
  testMessages: Partial<Record<MultiAiProvider, string>>;
  onApiKeysChange: (keys: MultiAiApiKeys) => void;
  onModelsChange: (models: MultiAiModels) => void;
  onSummaryProviderChange: (provider: MultiAiProvider) => void;
  onTest: (provider: MultiAiProvider) => void;
}) {
  return (
    <div className="mt-3 rounded border border-stone-200 bg-white p-3">
      <p className="text-sm leading-6 text-stone-700">API Key 僅暫存在本頁 session memory，不寫入 localStorage、資料庫或題庫 JSON。</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {multiAiProviders.map((provider) => (
          <div key={provider.id} className="rounded border border-stone-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{provider.label}</span>
              <button type="button" onClick={() => props.onTest(provider.id)} className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700">
                測試
              </button>
            </div>
            <input
              type="password"
              value={props.apiKeys[provider.id] || ''}
              onChange={(event) => props.onApiKeysChange({ ...props.apiKeys, [provider.id]: event.target.value })}
              placeholder={`${provider.label} API Key`}
              className="mt-2 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={props.models[provider.id] || provider.defaultModel}
              onChange={(event) => props.onModelsChange({ ...props.models, [provider.id]: event.target.value })}
              className="mt-2 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            {props.testMessages[provider.id] ? <p className="mt-2 text-xs leading-5 text-stone-600">{props.testMessages[provider.id]}</p> : null}
          </div>
        ))}
      </div>
      <label className="mt-3 block text-sm font-medium text-stone-700">
        一鍵總結 provider
        <select
          value={props.summaryProvider}
          onChange={(event) => props.onSummaryProviderChange(event.target.value as MultiAiProvider)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        >
          {multiAiProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MultiAiResults({
  activeProvider,
  results,
  onActiveProviderChange,
  onRetry,
}: {
  activeProvider: MultiAiProvider;
  results: MultiAiProviderResult[];
  onActiveProviderChange: (provider: MultiAiProvider) => void;
  onRetry: () => void;
}) {
  const activeResult = results.find((result) => result.provider === activeProvider) || results[0];
  return (
    <div className="mt-4">
      <h4 className="text-base font-semibold text-ink">Multi-AI 解題交叉驗證</h4>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
        {results.map((result) => (
          <button
            key={result.provider}
            type="button"
            onClick={() => onActiveProviderChange(result.provider)}
            className={`rounded border px-2 py-2 text-sm ${activeProvider === result.provider ? 'border-sea bg-teal-50 text-sea' : 'border-stone-300 bg-white text-stone-700'}`}
          >
            {providerLabel(result.provider)}
          </button>
        ))}
      </div>
      <div className="mt-3 sm:hidden">
        <ProviderCard result={activeResult} onRetry={onRetry} />
      </div>
      <div className="mt-3 hidden gap-3 sm:grid lg:grid-cols-2">
        {results.map((result) => (
          <ProviderCard key={result.provider} result={result} onRetry={onRetry} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ result, onRetry }: { result: MultiAiProviderResult; onRetry: () => void }) {
  return (
    <article className="rounded border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h5 className="font-semibold text-ink">{providerLabel(result.provider)}</h5>
          <p className="text-xs text-stone-500">{result.model || 'model 未設定'}</p>
        </div>
        <span className={`rounded px-2 py-1 text-xs ${statusClass(result.status)}`}>{statusLabel(result.status)}</span>
      </div>
      {result.latencyMs ? <p className="mt-2 text-xs text-stone-500">{result.latencyMs} ms</p> : null}
      {result.status === 'loading' ? <p className="mt-3 text-sm text-stone-600">解題中...</p> : null}
      {result.errorMessage ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
          <p>{result.errorCode || 'ERROR'}</p>
          <p>{result.errorMessage}</p>
          <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-900">
            <RefreshCcw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}
      {result.content ? <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-stone-800">{result.content}</div> : null}
    </article>
  );
}

function TextPanel({ content }: { content: string }) {
  return <div className="mt-4 whitespace-pre-wrap break-words rounded border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-800 sm:text-base">{content}</div>;
}

function toResultMap(nextResults: MultiAiProviderResult[]) {
  return Object.fromEntries(nextResults.map((result) => [result.provider, result])) as Record<MultiAiProvider, MultiAiProviderResult>;
}

function mapResults(
  current: Record<MultiAiProvider, MultiAiProviderResult>,
  mapper: (item: MultiAiProviderResult) => MultiAiProviderResult,
) {
  return Object.fromEntries(Object.entries(current).map(([provider, item]) => [provider, mapper(item as MultiAiProviderResult)])) as Record<
    MultiAiProvider,
    MultiAiProviderResult
  >;
}

function hasAnyMultiResult(results: MultiAiProviderResult[]) {
  return results.some((result) => result.status !== 'idle');
}

function providerLabel(provider: MultiAiProvider) {
  return multiAiProviders.find((item) => item.id === provider)?.label || provider;
}

function statusLabel(status: MultiAiProviderResult['status']) {
  return status === 'success' ? '完成' : status === 'error' ? '錯誤' : status === 'loading' ? 'Loading' : '待命';
}

function statusClass(status: MultiAiProviderResult['status']) {
  if (status === 'success') return 'bg-emerald-50 text-emerald-800';
  if (status === 'error') return 'bg-red-50 text-red-800';
  if (status === 'loading') return 'bg-amber-50 text-amber-800';
  return 'bg-stone-100 text-stone-600';
}
