import { handleMultiAiSummary } from '../../api/lib/multi-ai-core.js';

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return response(204, '');
  if (event.httpMethod !== 'POST') return response(405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', errorMessage: 'Method not allowed' });
  try {
    const result = await handleMultiAiSummary(JSON.parse(event.body || '{}'));
    return response(result.ok ? 200 : 502, result);
  } catch (caught) {
    return response(400, { ok: false, errorCode: 'REQUEST_ERROR', errorMessage: caught instanceof Error ? caught.message : 'Request failed' });
  }
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
