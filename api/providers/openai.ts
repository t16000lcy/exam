import { fetchWithTimeout, mapHttpError, ProviderError, requireApiKey, type ProviderAdapter, type ProviderRequest } from './types.js';

export const openaiProvider: ProviderAdapter = {
  id: 'openai',
  displayName: 'ChatGPT',
  defaultModel: 'gpt-4.1-mini',
  async solve(request: ProviderRequest) {
    const startedAt = Date.now();
    const model = request.model || openaiProvider.defaultModel;
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requireApiKey(request.apiKey, 'openai')}`,
        },
        body: JSON.stringify({ model, input: request.prompt }),
      },
      request.timeoutMs,
    );
    if (!response.ok) {
      throw new ProviderError(mapHttpError(response.status), await response.text(), response.status);
    }
    const data = await response.json();
    const content =
      data.output_text ||
      data.output?.flatMap((item: any) => item.content || []).map((item: any) => item.text).filter(Boolean).join('\n') ||
      '';
    return { provider: 'openai', model, content, latencyMs: Date.now() - startedAt };
  },
};
