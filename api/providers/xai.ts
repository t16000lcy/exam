import { fetchWithTimeout, mapHttpError, ProviderError, requireApiKey, type ProviderAdapter, type ProviderRequest } from './types.js';

export const xaiProvider: ProviderAdapter = {
  id: 'xai',
  displayName: 'Grok',
  defaultModel: 'grok-2-latest',
  async solve(request: ProviderRequest) {
    const startedAt = Date.now();
    const model = request.model || xaiProvider.defaultModel;
    const response = await fetchWithTimeout(
      'https://api.x.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requireApiKey(request.apiKey, 'xai')}`,
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
    return { provider: 'xai', model, content: data.choices?.[0]?.message?.content || '', latencyMs: Date.now() - startedAt };
  },
};
