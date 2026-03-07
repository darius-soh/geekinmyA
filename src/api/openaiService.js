const ARTICLE_CREDIBILITY_CACHE_KEY = 'surebo_article_credibility_cache_v4';
const ARTICLE_CREDIBILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const memoryCache = new Map();
const pendingRequests = new Map();
let cacheHydrated = false;

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }

  return body;
}

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function hashString(value) {
  const normalized = safeText(value);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function canonicalizeUrl(value) {
  const raw = safeText(value);
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }

    const keptParams = [...parsed.searchParams.entries()]
      .filter(([key]) => !/^utm_/i.test(key) && !['fbclid', 'gclid', 'ref', 'ref_src', 'share', 's'].includes(key.toLowerCase()))
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    parsed.search = '';
    keptParams.forEach(([key, paramValue]) => parsed.searchParams.append(key, paramValue));

    const pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = pathname || '/';

    return parsed.toString();
  } catch {
    return raw;
  }
}

function hydrateCache() {
  if (cacheHydrated || typeof window === 'undefined') return;
  cacheHydrated = true;

  try {
    const raw = window.sessionStorage.getItem(ARTICLE_CREDIBILITY_CACHE_KEY);
    if (!raw) return;

    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;

    entries.forEach(([key, value]) => {
      if (safeText(key) && value && typeof value === 'object') {
        memoryCache.set(key, value);
      }
    });
  } catch {
    // Ignore malformed cache payloads.
  }
}

function persistCache() {
  if (typeof window === 'undefined') return;

  try {
    const entries = Array.from(memoryCache.entries()).slice(-120);
    window.sessionStorage.setItem(ARTICLE_CREDIBILITY_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures.
  }
}

function readCachedArticleAssessment(cacheKey) {
  hydrateCache();

  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > ARTICLE_CREDIBILITY_CACHE_TTL_MS) {
    memoryCache.delete(cacheKey);
    persistCache();
    return null;
  }

  return cached.article;
}

function writeCachedArticleAssessment(cacheKey, article) {
  hydrateCache();
  memoryCache.set(cacheKey, {
    timestamp: Date.now(),
    article,
  });
  persistCache();
}

function getArticleFingerprint(article) {
  return hashString(JSON.stringify({
    canonicalUrl: canonicalizeUrl(article?.url || article?.originalUrl || article?.canonicalUrl),
    title: safeText(article?.title),
    description: safeText(article?.description),
    summary: safeText(article?.summary),
    publishedAt: safeText(article?.publishedAt),
    content: safeText(article?.scrapedContent || article?.content),
  }));
}

function getArticleCacheKey(article, language = 'en') {
  const canonicalUrl = canonicalizeUrl(article?.url || article?.originalUrl || article?.canonicalUrl);
  const fingerprint = getArticleFingerprint(article);
  if (canonicalUrl) {
    return `${canonicalUrl}|${safeText(language, 'en')}|${fingerprint}`;
  }

  if (safeText(article?.id)) {
    return `id:${article.id}|${safeText(language, 'en')}|${fingerprint}`;
  }

  return '';
}

export async function analyzeWithOpenAI({ text, url, language, fileName }) {
  return postJson('/api/credibility/search', {
    text,
    url,
    language,
    fileName,
  });
}

export async function assessOpenedArticle({ article, language }) {
  if (
    article?.credibilityStatus === 'ready'
    && article?.credibilityDetail
    && !article?.credibilityNeedsRefinement
  ) {
    return article;
  }

  const cacheKey = getArticleCacheKey(article, language);
  if (cacheKey) {
    const cachedArticle = readCachedArticleAssessment(cacheKey);
    if (cachedArticle) {
      return cachedArticle;
    }

    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }
  }

  const request = postJson('/api/credibility/article', {
    article,
    language,
  }).then((result) => {
    const assessedArticle = result.article || null;
    if (cacheKey && assessedArticle) {
      writeCachedArticleAssessment(cacheKey, assessedArticle);
    }
    return assessedArticle;
  }).finally(() => {
    if (cacheKey) {
      pendingRequests.delete(cacheKey);
    }
  });

  if (cacheKey) {
    pendingRequests.set(cacheKey, request);
  }

  return request;
}

export async function checkOpenAIStatus() {
  try {
    const response = await fetch('/api/credibility/status');
    if (!response.ok) return false;
    const body = await response.json();
    return Boolean(body.configured);
  } catch {
    return false;
  }
}

export default {
  analyzeWithOpenAI,
  assessOpenedArticle,
  checkOpenAIStatus,
};
