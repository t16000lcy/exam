import type { MultiAiProvider, MultiAiProviderResult, Question } from '../types';
import { getCorrectAnswerText, getQuestionId } from './questionMeta';

export const multiAiProviders: Array<{ id: MultiAiProvider; label: string; defaultModel: string }> = [
  { id: 'openai', label: 'ChatGPT', defaultModel: 'gpt-4.1-mini' },
  { id: 'gemini', label: 'Gemini', defaultModel: 'gemini-1.5-flash' },
  { id: 'xai', label: 'Grok', defaultModel: 'grok-2-latest' },
  { id: 'perplexity', label: 'Perplexity', defaultModel: 'sonar' },
];

export type MultiAiApiKeys = Partial<Record<MultiAiProvider, string>>;
export type MultiAiModels = Partial<Record<MultiAiProvider, string>>;

let sessionApiKeys: MultiAiApiKeys = {};
let sessionModels: MultiAiModels = Object.fromEntries(multiAiProviders.map((provider) => [provider.id, provider.defaultModel])) as MultiAiModels;
let tutorCachePromise: Promise<Record<string, { ai_full_text?: string }>> | null = null;

export function getSessionApiKeys() {
  return { ...sessionApiKeys };
}

export function setSessionApiKeys(keys: MultiAiApiKeys) {
  sessionApiKeys = { ...keys };
}

export function getSessionModels() {
  return { ...sessionModels };
}

export function setSessionModels(models: MultiAiModels) {
  sessionModels = { ...sessionModels, ...models };
}

export function getMultiAiApiBase() {
  const configured = (import.meta.env.VITE_MULTI_AI_API_BASE as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (window.location.hostname.endsWith('github.io')) return '';
  return '/api';
}

export async function buildQuestionPayload(question: Question, userAnswer: string) {
  const officialExplanation = await getOfficialExplanation(question);
  return {
    questionId: getQuestionId(question),
    subject: question.subject,
    questionStem: question.question_text || question.stem,
    options: Object.fromEntries(question.options.map((option) => [option.label, option.text])),
    userAnswer,
    correctAnswer: getCorrectAnswerText(question),
    officialExplanation,
  };
}

export async function solveWithMultiAi(question: Question, userAnswer: string) {
  const apiBase = getMultiAiApiBase();
  if (!apiBase) throw new Error('尚未設定 Multi-AI 後端。GitHub Pages 需另外部署 Vercel/Netlify API，並設定 VITE_MULTI_AI_API_BASE。');
  const payload = await buildQuestionPayload(question, userAnswer);
  const response = await fetch(`${apiBase}/multi-ai-solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      providers: multiAiProviders.map((provider) => provider.id),
      apiKeys: sessionApiKeys,
      models: sessionModels,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.errorMessage || 'Multi-AI 解題失敗');
  return data.results as MultiAiProviderResult[];
}

export async function summarizeMultiAi(question: Question, userAnswer: string, providerAnswers: MultiAiProviderResult[], summaryProvider: MultiAiProvider) {
  const apiBase = getMultiAiApiBase();
  if (!apiBase) throw new Error('尚未設定 Multi-AI 後端。');
  const payload = await buildQuestionPayload(question, userAnswer);
  const response = await fetch(`${apiBase}/multi-ai-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      providerAnswers,
      summaryProvider,
      apiKeys: sessionApiKeys,
      models: sessionModels,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.summary?.errorMessage || data.errorMessage || '一鍵總結失敗');
  return data.summary as MultiAiProviderResult;
}

export async function testProvider(provider: MultiAiProvider) {
  const apiBase = getMultiAiApiBase();
  if (!apiBase) throw new Error('尚未設定 Multi-AI 後端。');
  const response = await fetch(`${apiBase}/provider-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey: sessionApiKeys[provider],
      model: sessionModels[provider],
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.errorMessage || 'Provider test failed');
  return data as { ok: boolean; provider: MultiAiProvider; model: string; latencyMs: number };
}

async function getOfficialExplanation(question: Question) {
  const inline = question.ai_tutor?.ai_full_text || question.explanation_verified || question.explanation_ai_draft || '';
  if (inline) return inline;
  if (!tutorCachePromise) {
    tutorCachePromise = fetch(`${import.meta.env.BASE_URL}data/ai_tutor_cache.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  const cache = await tutorCachePromise;
  return cache[getQuestionId(question)]?.ai_full_text || '';
}

