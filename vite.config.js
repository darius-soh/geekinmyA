/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  analyzeSearchInput,
  assessOpenedArticle,
  extractArticle,
  isOpenAiConfigured,
} from './server/credibilityPipeline.js'

function normalizeEnvValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isPlaceholderKey(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return !normalized
    || normalized === 'your_openai_api_key_here';
}

// Server-side proxy plugin for OpenAI API calls
// This keeps the API key on the server side, never exposed to the browser
function openaiProxyPlugin(env) {
  return {
    name: 'openai-proxy',
    configureServer(server) {
      const getEnvValue = (viteKey, serverKey) => {
        const runtimeEnv = loadEnv(server.config.mode, process.cwd(), '');
        return normalizeEnvValue(
          process.env[serverKey]
          || (viteKey ? process.env[viteKey] : '')
          || runtimeEnv[serverKey]
          || (viteKey ? runtimeEnv[viteKey] : '')
          || env[serverKey]
          || (viteKey ? env[viteKey] : '')
        );
      };

      const readJsonBody = async (req) => {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        return body ? JSON.parse(body) : {};
      };

      const getOpenAiApiKey = () => getEnvValue('', 'OPENAI_API_KEY');

      // GET /api/credibility/status - confirm server-side OpenAI configuration
      server.middlewares.use('/api/credibility/status', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const apiKey = getOpenAiApiKey();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          configured: isOpenAiConfigured(apiKey) && !isPlaceholderKey(apiKey),
        }));
      });

      // POST /api/credibility/search - shared OpenAI credibility pipeline for the search flow
      server.middlewares.use('/api/credibility/search', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const apiKey = getOpenAiApiKey();
          if (isPlaceholderKey(apiKey)) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.',
            }));
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

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error('Search credibility proxy error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal credibility proxy error' }));
        }
      });

      // POST /api/credibility/article - shared OpenAI credibility pipeline for a single opened article
      server.middlewares.use('/api/credibility/article', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const payload = await readJsonBody(req);
          const apiKey = getOpenAiApiKey();
          const article = await assessOpenedArticle(payload.article, {
            apiKey: isPlaceholderKey(apiKey) ? '' : apiKey,
            language: payload.language || 'en',
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ article }));
        } catch (err) {
          console.error('Article credibility proxy error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal credibility proxy error' }));
        }
      });

      // POST /api/fetch-url — fetch article content from a URL (CORS-free)
      server.middlewares.use('/api/fetch-url', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const { url } = await readJsonBody(req);
          const extracted = await extractArticle(url);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(extracted));
        } catch (err) {
          console.error('URL fetch error:', err);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: err.message,
            url: '',
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), openaiProxyPlugin(env)],
  };
})
