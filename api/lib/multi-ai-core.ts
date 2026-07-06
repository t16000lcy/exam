import { buildMtExamSolvePrompt } from '../prompts/mt-exam-solve.js';
import { buildMtExamSummaryPrompt } from '../prompts/mt-exam-summary.js';
import { geminiProvider } from '../providers/gemini.js';
import { openaiProvider } from '../providers/openai.js';
import { perplexityProvider } from '../providers/perplexity.js';
import { ProviderError, type ProviderAdapter, type ProviderId } from '../providers/types.js';
import { xaiProvider } from '../providers/xai.js';

const providers: Record<ProviderId, ProviderAdapter> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  xai: xaiProvider,
  perplexity: perplexityProvider,
};

export const providerList = Object.values(providers).map((provider) => ({
  provider: provider.id,
  name: provider.displayName,
  defaultModel: provider.defaultModel,
}));

export async function handleMultiAiSolve(body: any) {
  const question = normalizeQuestionPayload(body);
  const apiKeys = body.apiKeys || {};
  const models = body.models || {};
  const prompt = buildMtExamSolvePrompt(question);
  const selectedProviders = normalizeProviders(body.providers);

  const results = await Promise.all(
    selectedProviders.map(async (providerId) => {
      const provider = providers[providerId];
      const startedAt = Date.now();
      try {
        const result = await provider.solve({
          apiKey: apiKeys[providerId],
          model: models[providerId],
          prompt,
          timeoutMs: body.timeoutMs,
        });
        logUsage({ questionId: question.questionId, provider: providerId, model: result.model, latencyMs: result.latencyMs, status: 'success' });
        return { ...result, status: 'success' };
      } catch (caught) {
        const error = normalizeError(caught);
        const latencyMs = Date.now() - startedAt;
        logUsage({ questionId: question.questionId, provider: providerId, model: models[providerId] || provider.defaultModel, latencyMs, status: 'error', errorCode: error.errorCode });
        return {
          provider: providerId,
          model: models[providerId] || provider.defaultModel,
          status: 'error',
          content: '',
          latencyMs,
          ...error,
        };
      }
    }),
  );

  return { ok: true, partialSuccess: results.some((item) => item.status === 'success') && results.some((item) => item.status === 'error'), results };
}

export async function handleMultiAiSummary(body: any) {
  const question = normalizeQuestionPayload(body);
  const providerId = normalizeProvider(body.summaryProvider || 'openai');
  const provider = providers[providerId];
  const apiKeys = body.apiKeys || {};
  const models = body.models || {};
  const prompt = buildMtExamSummaryPrompt({
    ...question,
    providerAnswers: body.providerAnswers || [],
  });

  const startedAt = Date.now();
  try {
    const result = await provider.solve({
      apiKey: apiKeys[providerId],
      model: models[providerId],
      prompt,
      timeoutMs: body.timeoutMs,
    });
    logUsage({ questionId: question.questionId, provider: providerId, model: result.model, latencyMs: result.latencyMs, status: 'success' });
    return { ok: true, summary: { ...result, status: 'success' } };
  } catch (caught) {
    const error = normalizeError(caught);
    const latencyMs = Date.now() - startedAt;
    logUsage({ questionId: question.questionId, provider: providerId, model: models[providerId] || provider.defaultModel, latencyMs, status: 'error', errorCode: error.errorCode });
    return { ok: false, summary: { provider: providerId, model: models[providerId] || provider.defaultModel, status: 'error', content: '', latencyMs, ...error } };
  }
}

export async function handleProviderTest(body: any) {
  const providerId = normalizeProvider(body.provider);
  const provider = providers[providerId];
  const startedAt = Date.now();
  try {
    const result = await provider.solve({
      apiKey: body.apiKey,
      model: body.model,
      prompt: '請用繁體中文回答：連線測試成功。',
      timeoutMs: body.timeoutMs || 20_000,
    });
    logUsage({ questionId: 'provider-test', provider: providerId, model: result.model, latencyMs: result.latencyMs, status: 'success' });
    return { ok: true, provider: providerId, model: result.model, latencyMs: result.latencyMs };
  } catch (caught) {
    const error = normalizeError(caught);
    const latencyMs = Date.now() - startedAt;
    logUsage({ questionId: 'provider-test', provider: providerId, model: body.model || provider.defaultModel, latencyMs, status: 'error', errorCode: error.errorCode });
    return { ok: false, provider: providerId, model: body.model || provider.defaultModel, latencyMs, ...error };
  }
}

function normalizeQuestionPayload(body: any) {
  return {
    questionId: String(body.questionId || ''),
    subject: String(body.subject || ''),
    questionStem: String(body.questionStem || ''),
    options: body.options || {},
    userAnswer: String(body.userAnswer || ''),
    correctAnswer: String(body.correctAnswer || ''),
    officialExplanation: String(body.officialExplanation || ''),
  };
}

function normalizeProviders(input: unknown): ProviderId[] {
  if (!Array.isArray(input) || input.length === 0) return ['openai', 'gemini', 'xai', 'perplexity'];
  return input.map(normalizeProvider);
}

function normalizeProvider(input: unknown): ProviderId {
  if (input === 'openai' || input === 'gemini' || input === 'xai' || input === 'perplexity') return input;
  throw new ProviderError('PROVIDER_UNAVAILABLE', `Unsupported provider: ${String(input)}`);
}

function normalizeError(caught: unknown) {
  if (caught instanceof ProviderError) {
    return { errorCode: caught.code, errorMessage: caught.message };
  }
  return {
    errorCode: 'PROVIDER_ERROR',
    errorMessage: caught instanceof Error ? caught.message : 'Provider request failed',
  };
}

function logUsage(entry: { questionId: string; provider: ProviderId; model: string; latencyMs: number; status: string; errorCode?: string }) {
  const safeEntry = { ...entry, createdAt: new Date().toISOString() };
  console.info(JSON.stringify({ event: 'multi_ai_usage', ...safeEntry }));
}
