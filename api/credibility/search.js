import { analyzeSearchInput } from '../../server/credibilityPipeline.js';
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
    const apiKey = getOpenAiApiKey();
    if (isPlaceholderKey(apiKey)) {
      sendJson(res, 500, {
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your Vercel environment variables.',
      });
      return;
    }

    const payload = await readJsonBody(req);
    const result = await analyzeSearchInput({
      text: payload.text,
      url: payload.url,
      language: payload.language,
      fileName: payload.fileName,
      apiKey,
    });

    sendJson(res, 200, result);
  } catch (error) {
    console.error('Search credibility API error:', error);
    sendJson(res, 500, {
      error: error?.message || 'Internal credibility API error',
    });
  }
}
