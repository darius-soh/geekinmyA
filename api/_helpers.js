/* global process */
function normalizeEnvValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function isPlaceholderKey(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return !normalized || normalized === 'your_openai_api_key_here';
}

export function getOpenAiApiKey() {
  return normalizeEnvValue(process.env.OPENAI_API_KEY);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
