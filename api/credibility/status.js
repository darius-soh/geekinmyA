import { isOpenAiConfigured } from '../../server/credibilityPipeline.js';
import { getOpenAiApiKey, isPlaceholderKey, sendJson } from '../_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = getOpenAiApiKey();
  sendJson(res, 200, {
    configured: isOpenAiConfigured(apiKey) && !isPlaceholderKey(apiKey),
  });
}
