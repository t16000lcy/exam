import { handleMultiAiSolve } from './lib/multi-ai-core.js';
import { handleOptionsOrMethod, setCors } from './_utils.js';

export default async function handler(request: any, response: any) {
  if (handleOptionsOrMethod(request, response)) return;
  try {
    const result = await handleMultiAiSolve(request.body || {});
    setCors(response);
    response.status(200).json(result);
  } catch (caught) {
    setCors(response);
    response.status(400).json({
      ok: false,
      errorCode: 'REQUEST_ERROR',
      errorMessage: caught instanceof Error ? caught.message : 'Request failed',
    });
  }
}
