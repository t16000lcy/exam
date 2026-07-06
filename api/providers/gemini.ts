import { fetchWithTimeout, mapHttpError, ProviderError, requireApiKey, type ProviderAdapter, type ProviderRequest } from './types.js';

export const geminiProvider: ProviderAdapter = {
  id: 'gemini',
  displayName: 'Gemini',
  defaultModel: 'gemini-1.5-flash',
  async solve(request: ProviderRequest) {
    const startedAt = Date.now();
    const model = request.model || geminiProvider.defaultModel;
    const key = encodeURIComponent(requireApiKey(request.apiKey, 'gemini'));
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: request.prompt }] }] }),
      },
      request.timeoutMs,
    );
    if (!response.ok) {
      throw new ProviderError(mapHttpError(response.status), await response.text(), response.status);
    }
    const data = await response.json();
    const content = data.candidates?.flatMap((candidate: any) => candidate.content?.parts || []).map((part: any) => part.text).filter(Boolean).join('\n') || '';
    return { provider: 'gemini', model, content, latencyMs: Date.now() - startedAt };
  },
};
