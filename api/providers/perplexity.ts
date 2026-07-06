import { fetchWithTimeout, mapHttpError, ProviderError, requireApiKey, type ProviderAdapter, type ProviderRequest } from './types.js';

export const perplexityProvider: ProviderAdapter = {
  id: 'perplexity',
  displayName: 'Perplexity',
  defaultModel: 'sonar',
  async solve(request: ProviderRequest) {
    const startedAt = Date.now();
    const model = request.model || perplexityProvider.defaultModel;
    const response = await fetchWithTimeout(
      'https://api.perplexity.ai/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requireApiKey(request.apiKey, 'perplexity')}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: 0.2,
        }),
      },
      request.timeoutMs,
    );
    if (!response.ok) {
      throw new ProviderError(mapHttpError(response.status), await response.text(), response.status);
    }
    const data = await response.json();
    return { provider: 'perplexity', model, content: data.choices?.[0]?.message?.content || '', latencyMs: Date.now() - startedAt };
  },
};
