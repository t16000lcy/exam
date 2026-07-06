import { handleMultiAiSolve } from '../../api/lib/multi-ai-core.js';

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return response(204, '');
  if (event.httpMethod !== 'POST') return response(405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', errorMessage: 'Method not allowed' });
  try {
    return response(200, await handleMultiAiSolve(JSON.parse(event.body || '{}')));
  } catch (caught) {
    return response(400, { ok: false, errorCode: 'REQUEST_ERROR', errorMessage: caught instanceof Error ? caught.message : 'Request failed' });
  }
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
