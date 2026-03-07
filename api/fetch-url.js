import { extractArticle } from '../server/credibilityPipeline.js';
import { readJsonBody, sendJson } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const extracted = await extractArticle(payload.url);
    sendJson(res, 200, extracted);
  } catch (error) {
    console.error('Fetch URL API error:', error);
    sendJson(res, 500, {
      success: false,
      error: error?.message || 'Internal fetch URL error',
      url: '',
    });
  }
}
