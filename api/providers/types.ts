export type ProviderId = 'openai' | 'gemini' | 'xai' | 'perplexity';

export interface ProviderRequest {
  apiKey: string;
  model?: string;
  prompt: string;
  timeoutMs?: number;
}

export interface ProviderResponse {
  provider: ProviderId;
  model: string;
  content: string;
  latencyMs: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  displayName: string;
  defaultModel: string;
  solve(request: ProviderRequest): Promise<ProviderResponse>;
}

export class ProviderError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
  }
}

export function requireApiKey(apiKey: string | undefined, provider: ProviderId) {
  if (!apiKey?.trim()) {
    throw new ProviderError('API_KEY_MISSING', `${provider} API key missing`);
  }
  return apiKey.trim();
}

export function mapHttpError(status: number) {
  if (status === 401 || status === 403) return 'INVALID_API_KEY';
  if (status === 408) return 'TIMEOUT';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  return 'PROVIDER_ERROR';
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new ProviderError('TIMEOUT', 'Provider request timed out');
    }
    throw new ProviderError('PROVIDER_UNAVAILABLE', caught instanceof Error ? caught.message : 'Provider unavailable');
  } finally {
    clearTimeout(timer);
  }
}

