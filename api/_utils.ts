export function setCors(response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleOptionsOrMethod(request: any, response: any) {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return true;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, errorCode: 'METHOD_NOT_ALLOWED', errorMessage: 'Method not allowed' });
    return true;
  }
  return false;
}

