import { handleProviderTest } from './lib/multi-ai-core.js';
import { handleOptionsOrMethod, setCors } from './_utils.js';

export default async function handler(request: any, response: any) {
  if (handleOptionsOrMethod(request, response)) return;
  try {
    const result = await handleProviderTest(request.body || {});
    setCors(response);
    response.status(result.ok ? 200 : 502).json(result);
  } catch (caught) {
    setCors(response);
    response.status(400).json({
      ok: false,
      errorCode: 'REQUEST_ERROR',
      errorMessage: caught instanceof Error ? caught.message : 'Request failed',
    });
  }
}
