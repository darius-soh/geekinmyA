import { assessOpenedArticle } from '../../server/credibilityPipeline.js';
import {
  getOpenAiApiKey,
  isPlaceholderKey,
  readJsonBody,
  sendJson,
} from '../_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const apiKey = getOpenAiApiKey();
    const article = await assessOpenedArticle(payload.article, {
      apiKey: isPlaceholderKey(apiKey) ? '' : apiKey,
      language: payload.language || 'en',
    });

    sendJson(res, 200, { article });
  } catch (error) {
    console.error('Article credibility API error:', error);
    sendJson(res, 500, {
      error: error?.message || 'Internal credibility API error',
    });
  }
}
