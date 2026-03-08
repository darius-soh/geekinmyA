import { createHash } from 'node:crypto';
import { evaluateCredibleSourceSimilarity } from './pineconeCredibility.js';
import {
  extractDomainFromUrl,
  getCredibleSourceByDomain,
  loadCredibleSources,
  normalizeDomain,
} from './credibleSources.js';
import {
  clampScore,
  deriveCredibilityAssessment,
  verdictToAppCredibility,
} from '../shared/credibilityModel.js';
import { buildInitialArticleCredibility } from '../shared/sourceRegistryAssessment.js';
import {
  buildClaimCheckResult,
  CLAIM_INPUT_TYPES,
  CLAIM_VERDICTS,
  detectClaimInputType,
  deriveConfidence,
  extractFirstUrl,
  legacyCredibilityFromVerdict,
  normalizeQuestionToClaimHeuristic,
  normalizeWhitespace as normalizeClaimWhitespace,
  verdictFromClaimSupportScore,
} from '../shared/claimCheckModel.js';

const ARTICLE_EXTRACTION_CACHE_TTL_MS = 30 * 60 * 1000;
const CREDIBILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CREDIBILITY_OUTPUT_VERSION = 'v3';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_BODY_CHARACTERS = 12_000;
const MAX_SUMMARY_CHARACTERS = 360;
const MAX_EVIDENCE_RESULTS = 6;
const MAX_CLAIMS_TO_CHECK = 3;
const SEARCH_TIMEOUT_MS = 10_000;
const SEARCH_RESULT_WINDOW = 1_800;
const SEARCH_USER_AGENT = 'Mozilla/5.0 (compatible; SureBoClaimRetriever/1.0)';

const extractionCache = new Map();
const articleCredibilityCache = new Map();
const searchCredibilityCache = new Map();

const TRACKING_QUERY_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'ref',
  'ref_src',
  'ref_url',
  's',
  'share',
  'spm',
]);

const DUCKDUCKGO_SEARCH_ENDPOINTS = [
  'https://html.duckduckgo.com/html/',
  'https://duckduckgo.com/html/',
];

const PRIMARY_SOURCE_TYPES = new Set([
  'government',
  'public-health-agency',
  'regulator',
  'statistics-agency',
  'public-institution',
  'central-bank',
  'international-organization',
  'university',
  'scientific-publisher',
]);

const TRUSTED_SOURCE_TYPES = new Set([
  ...PRIMARY_SOURCE_TYPES,
  'newspaper',
  'public-broadcaster',
  'broadcaster',
  'journalism',
  'digital-news-site',
  'fact-checker',
]);

const SECONDARY_EVIDENCE_DOMAINS = new Set([
  'wikipedia.org',
  'www.wikipedia.org',
  'britannica.com',
  'www.britannica.com',
]);

const SYSTEM_PROMPT = `You are a credibility assessment engine for news articles and user-submitted news claims.

Your task is to assess credibility using ONLY the material provided in the input, including article text, headline, metadata, source name, publication date, and any supplied context.

Your goal is not to decide whether you personally agree with the article.
Your goal is to evaluate how well the article's claims are supported by the evidence presented.

Core rules:
- Do not assume an article is credible simply because it comes from a well-known publisher.
- Do not assume an article is not credible simply because it comes from an unfamiliar publisher.
- Never invent facts, sources, dates, quotations, experts, documents, corroboration, or context.
- If the article text is incomplete, truncated, missing, or only partially available, explicitly say so and reduce confidence.
- If corroboration is not provided in the input, do not pretend you verified it elsewhere.
- If a claim cannot be judged from the supplied material alone, use "undetermined" or "mixed" rather than overstating certainty.
- Be skeptical of strong headlines backed by weak or vague evidence.
- Distinguish between:
  - poor journalism or weak evidence
  - clear internal inconsistency
  - sensational framing
  - genuinely false or unsupported claims
- Prefer cautious, explainable judgments over overconfident ones.

Evaluate the material using these criteria:
1. Headline-body consistency
- Does the body actually support the headline?
- Is the headline more dramatic, absolute, or emotional than the article text?

2. Evidence quality
- Does the article cite named experts, official documents, direct data, primary sources, eyewitnesses, or verifiable records?
- Are claims attributed clearly, or presented vaguely without support?

3. Corroboration
- Does the supplied context indicate independent confirmation from multiple sources?
- If no corroboration information is provided, treat this as unknown rather than confirmed.

4. Context and caveats
- Does the article omit important qualifications, uncertainty, timing, or relevant background?
- Are exceptions or limitations hidden or ignored?

5. Language and framing
- Is the wording sensational, emotionally manipulative, exaggerated, conspiratorial, or misleadingly absolute?
- Watch for phrases that overstate certainty without evidence.

6. Source and recency
- Consider source reputation only as one signal, never as decisive proof.
- Consider publication date and timeliness where relevant.
- Old information presented as current should lower credibility.

Verdict definitions:
- "credible": claims are generally supported by specific evidence, internally consistent, and not obviously overstated based on the supplied material.
- "mixed": some parts appear supported, but there are notable weaknesses such as overstated framing, missing caveats, incomplete support, or unresolved concerns.
- "not_credible": major claims are unsupported, contradicted by the provided material, internally inconsistent, or heavily sensationalized beyond the evidence.
- "undetermined": there is not enough information to make a reliable judgment.

Scoring rules:
- All scores must be integers from 0 to 100.
- credibilityScore:
  - 80-100: strong support and low concern
  - 60-79: mostly supported but some concerns
  - 40-59: mixed or uncertain
  - 20-39: weak support and serious concerns
  - 0-19: highly unsupported or strongly misleading based on the provided material
- confidenceScore:
  - High when article text is complete and evidence is clear
  - Lower when text is partial, context is missing, or the assessment depends on unresolved uncertainty
  


Signal scoring rules:
- sourceAuthority: how trustworthy and established the source appears from the provided metadata only
- corroboration: extent of independent confirmation provided in the input
- evidenceQuality: quality and specificity of support inside the article
- recency: whether the timing is current and relevant for the claim being made
- sensationalismRisk: higher score means greater risk of sensational, manipulative, or overstated framing

Important output requirements:
- Return valid JSON only.
- Return no markdown, no code fences, no commentary, and no extra keys.
- If the input contains "preferredOutputLanguage" or "preferredOutputLanguageName", write every user-facing string field in that language while keeping the JSON keys in English.
- When "preferredOutputLanguage" is "zh", write in Simplified Chinese.
- Keep "articleSummary" concise and factual.
- Keep "explanation" clear, specific, and understandable to ordinary users.
- "keyFindings" should contain short, concrete points.
- "limitations" must explicitly state missing information, partial text, unknown corroboration, or any other uncertainty.
- "recommendedNextStep" should be practical, such as:
  - "Check the full article and primary sources"
  - "Look for independent confirmation"
  - "Treat cautiously until verified"
  - "Likely safe to rely on, but monitor for updates"

Return valid JSON only with this exact shape:
{
  "headline": "string",
  "articleSummary": "string",
  "verdict": "credible | mixed | not_credible | undetermined",
  "credibilityScore": 0,
  "confidenceScore": 0,
  "explanation": "string",
  "keyFindings": ["string"],
  "signals": {
    "sourceAuthority": 0,
    "corroboration": 0,
    "evidenceQuality": 0,
    "recency": 0,
    "sensationalismRisk": 0
  },
  "limitations": ["string"],
  "recommendedNextStep": "string"
}`;
  

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return safeText(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function hashText(value) {
  return createHash('sha1').update(safeText(value)).digest('hex').slice(0, 16);
}

function normalizeDate(value) {
  const raw = safeText(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function normalizeSource(value) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeHeadline(value) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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
      .filter(([key]) => !/^utm_/i.test(key) && !TRACKING_QUERY_PARAMS.has(key.toLowerCase()))
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

function detectLanguage(text) {
  const value = safeText(text);
  if (!value) return 'en';

  if (/[\u0B80-\u0BFF]/.test(value)) return 'ta';
  if (/[\u4E00-\u9FFF]/.test(value)) return 'zh';

  const malayKeywords = ['dan', 'yang', 'untuk', 'dalam', 'dengan', 'tidak', 'adalah', 'ini', 'itu'];
  const words = value.toLowerCase().split(/\s+/);
  const matches = words.filter(word => malayKeywords.includes(word)).length;
  if (matches >= 2) return 'ms';

  return 'en';
}

function resolveOutputLanguageName(languageCode) {
  switch (safeText(languageCode, 'en').toLowerCase()) {
    case 'zh':
      return 'Simplified Chinese';
    case 'ms':
      return 'Bahasa Melayu';
    case 'ta':
      return 'Tamil';
    case 'en':
    default:
      return 'English';
  }
}

function stripHtml(value) {
  return decodeHtmlEntities(
    safeText(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\n{3,}/g, '\n\n');
}

function pickFirst(...values) {
  return values.find(value => safeText(value)) || '';
}

function extractMeta(html, attribute, key) {
  const pattern = new RegExp(
    `<meta[^>]*${attribute}=["']${key}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`,
    'i'
  );
  const reversePattern = new RegExp(
    `<meta[^>]*content=["']([\\s\\S]*?)["'][^>]*${attribute}=["']${key}["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern) || html.match(reversePattern);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function flattenJsonLd(node) {
  if (!node) return [];
  if (Array.isArray(node)) {
    return node.flatMap(flattenJsonLd);
  }
  if (typeof node !== 'object') return [];
  if (Array.isArray(node['@graph'])) {
    return flattenJsonLd(node['@graph']);
  }
  return [node];
}

function parseJsonLdBlocks(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];

  matches.forEach((match) => {
    const raw = safeText(match[1]);
    if (!raw) return;

    try {
      nodes.push(...flattenJsonLd(JSON.parse(raw)));
    } catch {
      const cleaned = raw.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      try {
        nodes.push(...flattenJsonLd(JSON.parse(cleaned)));
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }
  });

  return nodes;
}

function isArticleJsonLd(node) {
  const type = node?.['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some(item => /article|newsarticle|reportagenewsarticle|blogposting/i.test(safeText(item)));
}

function extractJsonLdText(node, key) {
  const value = node?.[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => extractJsonLdText(item, key)).find(Boolean) || '';
  }
  if (value && typeof value === 'object') {
    return pickFirst(value.name, value.text, value.url);
  }
  return '';
}

function extractJsonLdImage(node) {
  const value = node?.image;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => extractJsonLdImage({ image: item })).find(Boolean) || '';
  }
  if (value && typeof value === 'object') {
    return pickFirst(value.url, value.contentUrl);
  }
  return '';
}

function extractParagraphs(html) {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => normalizeWhitespace(stripHtml(match[1])))
    .filter(paragraph => paragraph.length >= 55);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  const bodyText = stripHtml(html)
    .split(/\n+/)
    .map(line => normalizeWhitespace(line))
    .filter(line => line.length >= 80);

  return bodyText;
}

function selectArticleHtml(html) {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function splitIntoSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 35);
}

function buildSummaryFromText({ title, description, content }) {
  const summaryParts = [];
  const normalizedDescription = normalizeWhitespace(description);
  const sentences = splitIntoSentences(content);

  if (normalizedDescription) {
    summaryParts.push(normalizedDescription);
  }

  for (const sentence of sentences) {
    if (summaryParts.length >= 3) break;
    if (summaryParts.some(part => part === sentence)) continue;
    if (normalizeHeadline(sentence) === normalizeHeadline(title)) continue;
    summaryParts.push(sentence);
  }

  const summary = normalizeWhitespace(summaryParts.join(' '));
  if (summary.length <= MAX_SUMMARY_CHARACTERS) {
    return summary;
  }

  return `${summary.slice(0, MAX_SUMMARY_CHARACTERS - 1).trim()}...`;
}

function getArticleIdentity(article) {
  const canonicalUrl = canonicalizeUrl(article?.url || article?.originalUrl || article?.canonicalUrl);
  if (canonicalUrl) return canonicalUrl;

  const normalizedTitle = normalizeHeadline(article?.title || article?.headline);
  const normalizedSource = normalizeSource(article?.source || article?.sourceName);
  const publishedDate = normalizeDate(article?.publishedAt || article?.publishDate).slice(0, 10);

  if (normalizedSource && normalizedTitle) {
    return `source-title:${normalizedSource}|${normalizedTitle}`;
  }

  if (normalizedTitle && publishedDate) {
    return `title-date:${normalizedTitle}|${publishedDate}`;
  }

  return `fallback:${hashText(JSON.stringify(article || {}))}`;
}

function buildArticleFingerprint(article, extracted = null) {
  return hashText(JSON.stringify({
    canonicalUrl: canonicalizeUrl(article?.url || article?.originalUrl || article?.canonicalUrl),
    title: pickFirst(article?.title, extracted?.title),
    description: pickFirst(article?.description, extracted?.description),
    publishedAt: pickFirst(article?.publishedAt, extracted?.publishedAt),
    summary: safeText(article?.summary),
    content: pickFirst(extracted?.content, article?.scrapedContent, article?.content),
  }));
}

function readTimedCache(cache, key, ttlMs) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function writeTimedCache(cache, key, value) {
  cache.set(key, {
    timestamp: Date.now(),
    value,
  });
}

function normalizeAnalysisResponse(parsed, fallback = {}) {
  const articleSummary = normalizeWhitespace(parsed?.articleSummary || fallback.articleSummary);
  const explanation = normalizeWhitespace(parsed?.explanation || articleSummary);
  const keyFindings = Array.isArray(parsed?.keyFindings)
    ? parsed.keyFindings.map(item => normalizeWhitespace(item)).filter(Boolean).slice(0, 5)
    : [];
  const limitations = Array.isArray(parsed?.limitations)
    ? parsed.limitations.map(item => normalizeWhitespace(item)).filter(Boolean).slice(0, 4)
    : [];
  const rawSignals = parsed?.signals && typeof parsed.signals === 'object' ? parsed.signals : {};

  const signals = {
    sourceAuthority: clampScore(rawSignals.sourceAuthority, 50),
    corroboration: clampScore(rawSignals.corroboration, 40),
    evidenceQuality: clampScore(rawSignals.evidenceQuality, 45),
    recency: clampScore(rawSignals.recency, 50),
    sensationalismRisk: clampScore(rawSignals.sensationalismRisk, 50),
  };
  const derivedAssessment = deriveCredibilityAssessment({
    verdict: parsed?.verdict,
    credibilityScore: parsed?.credibilityScore,
    confidenceScore: parsed?.confidenceScore,
    signals,
  });

  return {
    headline: safeText(parsed?.headline, fallback.headline),
    articleSummary,
    rawVerdict: derivedAssessment.rawVerdict,
    verdict: derivedAssessment.verdict,
    credibilityScore: derivedAssessment.credibilityScore,
    confidenceScore: derivedAssessment.confidenceScore,
    explanation,
    keyFindings,
    signals: derivedAssessment.signals,
    limitations,
    recommendedNextStep: normalizeWhitespace(parsed?.recommendedNextStep),
    rating: derivedAssessment.rating,
    confidence: derivedAssessment.confidence,
    appCredibility: derivedAssessment.appCredibility,
    evidenceSignalScore: derivedAssessment.evidenceSignalScore,
    combinedScore: derivedAssessment.combinedScore,
  };
}

async function requestOpenAIJson({
  apiKey,
  payload,
  systemPrompt = SYSTEM_PROMPT,
  maxTokens = 1200,
}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload, null, 2) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON.');
  }

  return parsed;
}

async function callOpenAIJson({ apiKey, payload, fallback }) {
  const parsed = await requestOpenAIJson({
    apiKey,
    payload,
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 1200,
  });
  return normalizeAnalysisResponse(parsed, fallback);
}

function buildArticleCredibilityObject(analysis) {
  return {
    score: analysis.credibilityScore,
    rating: analysis.rating,
    verdict: analysis.verdict,
    confidence: analysis.confidence,
    confidenceScore: analysis.confidenceScore,
    evidenceSignalScore: analysis.evidenceSignalScore,
    summary: analysis.explanation || analysis.articleSummary,
    signals: analysis.keyFindings.slice(0, 3),
    caveats: analysis.limitations,
  };
}

function buildUnavailableSourceSimilarity(reason) {
  return {
    status: 'unavailable',
    credibilitySignal: 'unknown',
    similarityScore: 0,
    exactDomainMatch: false,
    topMatches: [],
    explanation: normalizeWhitespace(reason || 'Credible source similarity unavailable.'),
    note: 'This is a trust signal, not a definitive truth judgment.',
    scoringBreakdown: {
      exactDomainBoost: 0,
      semanticBoost: 0,
      metadataBoost: 0,
      totalScore: 0,
    },
  };
}

function createSyntheticExtraction(article) {
  return {
    success: false,
    url: safeText(article?.url || article?.originalUrl),
    canonicalUrl: canonicalizeUrl(article?.url || article?.originalUrl || article?.canonicalUrl),
    title: safeText(article?.title),
    description: safeText(article?.description),
    siteName: safeText(article?.source),
    author: safeText(article?.author),
    publishedAt: normalizeDate(article?.publishedAt),
    imageUrl: safeText(article?.imageUrl),
    content: safeText(article?.scrapedContent || article?.content),
    error: 'Remote extraction was skipped for local article content.',
  };
}

function mergeLocalAssessment(article, localAssessment, overrides = {}) {
  return {
    ...article,
    ...localAssessment,
    ...overrides,
    credibilityStatus: overrides.credibilityStatus || localAssessment.credibilityStatus || 'ready',
    credibility: overrides.credibility || localAssessment.credibility,
    credibilityAnalysis: overrides.credibilityAnalysis || localAssessment.credibilityAnalysis,
    credibilityDetail: overrides.credibilityDetail || localAssessment.credibilityDetail,
    credibleSourceSimilarity: overrides.credibleSourceSimilarity || localAssessment.credibleSourceSimilarity,
    matchedSource: overrides.matchedSource || localAssessment.matchedSource,
    credibilityNeedsRefinement: overrides.credibilityNeedsRefinement ?? localAssessment.credibilityNeedsRefinement,
    credibilityStage: overrides.credibilityStage || localAssessment.credibilityStage || 'local',
    lastEvaluatedAt: overrides.lastEvaluatedAt || localAssessment.lastEvaluatedAt || new Date().toISOString(),
  };
}

function shouldCallOpenAi(localAssessment, sourceSimilarity) {
  if (!localAssessment?.credibilityNeedsRefinement) return false;
  if (!sourceSimilarity) return true;
  if (sourceSimilarity.status === 'unavailable') return true;
  if (sourceSimilarity.exactDomainMatch) return false;
  return sourceSimilarity.credibilitySignal === 'medium';
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

export async function extractArticle(url, metadata = {}) {
  const canonicalUrl = canonicalizeUrl(url);
  const cacheKey = canonicalUrl || `raw:${hashText(url)}`;
  const cached = readTimedCache(extractionCache, cacheKey, ARTICLE_EXTRACTION_CACHE_TTL_MS);
  if (cached) {
    return {
      ...cached,
      title: pickFirst(cached.title, metadata.title),
      description: pickFirst(cached.description, metadata.description),
      siteName: pickFirst(cached.siteName, metadata.source),
      author: pickFirst(cached.author, metadata.author),
      publishedAt: pickFirst(cached.publishedAt, metadata.publishedAt),
      imageUrl: pickFirst(cached.imageUrl, metadata.imageUrl),
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SureBoBot/2.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article (${response.status})`);
    }

    const html = await response.text();
    const jsonLdNodes = parseJsonLdBlocks(html).filter(isArticleJsonLd);
    const firstArticleJsonLd = jsonLdNodes[0] || {};
    const selectedHtml = selectArticleHtml(html);

    const title = pickFirst(
      extractMeta(html, 'property', 'og:title'),
      extractMeta(html, 'name', 'twitter:title'),
      extractJsonLdText(firstArticleJsonLd, 'headline'),
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      metadata.title
    );

    const description = pickFirst(
      extractMeta(html, 'property', 'og:description'),
      extractMeta(html, 'name', 'description'),
      extractJsonLdText(firstArticleJsonLd, 'description'),
      metadata.description
    );

    const siteName = pickFirst(
      extractMeta(html, 'property', 'og:site_name'),
      extractJsonLdText(firstArticleJsonLd?.publisher, 'name'),
      metadata.source
    );

    const author = pickFirst(
      extractJsonLdText(firstArticleJsonLd, 'author'),
      extractMeta(html, 'name', 'author'),
      metadata.author
    );

    const publishedAt = pickFirst(
      normalizeDate(extractMeta(html, 'property', 'article:published_time')),
      normalizeDate(extractMeta(html, 'name', 'pubdate')),
      normalizeDate(extractJsonLdText(firstArticleJsonLd, 'datePublished')),
      normalizeDate(metadata.publishedAt)
    );

    const imageUrl = pickFirst(
      extractMeta(html, 'property', 'og:image'),
      extractMeta(html, 'name', 'twitter:image'),
      extractJsonLdImage(firstArticleJsonLd),
      metadata.imageUrl
    );

    const paragraphs = extractParagraphs(selectedHtml);
    const content = normalizeWhitespace(
      pickFirst(
        extractJsonLdText(firstArticleJsonLd, 'articleBody'),
        paragraphs.join(' '),
        stripHtml(selectedHtml)
      )
    ).slice(0, MAX_BODY_CHARACTERS);

    const extracted = {
      success: true,
      url,
      canonicalUrl,
      title: normalizeWhitespace(title),
      description: normalizeWhitespace(description),
      siteName: normalizeWhitespace(siteName),
      author: normalizeWhitespace(author),
      publishedAt,
      imageUrl: safeText(imageUrl),
      content,
    };

    writeTimedCache(extractionCache, cacheKey, extracted);
    return extracted;
  } catch (error) {
    return {
      success: false,
      url,
      canonicalUrl,
      title: safeText(metadata.title),
      description: safeText(metadata.description),
      siteName: safeText(metadata.source),
      author: safeText(metadata.author),
      publishedAt: normalizeDate(metadata.publishedAt),
      imageUrl: safeText(metadata.imageUrl),
      content: '',
      error: error?.message || 'Failed to extract article content.',
    };
  }
}

export function isOpenAiConfigured(apiKey) {
  return Boolean(safeText(apiKey));
}

const QUESTION_NORMALIZATION_PROMPT = `You convert user questions into neutral factual claims for evidence checking.

Rules:
- Never judge the question itself as credible or not credible.
- For yes/no questions, rewrite the question into a concise affirmative factual claim.
- For who/what/when/where questions, do not invent an answer. If the answer must come from evidence, return normalizedClaim as null and provide a claimTemplate containing "{answer}".
- Preserve the original entities, offices, places, and dates.
- Keep the claim concise, neutral, and checkable.
- Return valid JSON only with exactly this shape:
{
  "normalizedClaim": "string | null",
  "needsAnswerFromEvidence": true,
  "claimTemplate": "string | null",
  "ambiguity": "string | null"
}`;

const ARTICLE_CLAIM_EXTRACTION_PROMPT = `Extract the 1 to 3 most important factual claims from a news article.

Rules:
- Prefer concrete claims from the headline and lead paragraphs.
- Keep each claim short, neutral, and checkable.
- Do not include opinions, speculation, or recommendations.
- Return valid JSON only with exactly this shape:
{
  "claims": ["string"]
}`;

const EVIDENCE_SYNTHESIS_PROMPT = `You are an evidence-grounded claim verification engine.

Use only the evidence pack provided by the user. Do not use outside knowledge.

Important rules:
- Never judge the user's question itself as credible or not credible.
- Judge whether the underlying factual claim is supported by the retrieved evidence.
- Keep source credibility separate from claim support.
- Prefer official and primary sources when they are present.
- If evidence is missing or weak, keep the score in the mixed / inconclusive band rather than calling the claim unsupported.
- Lower confidence when there are few sources, conflicting sources, outdated sources, retrieval failures, or ambiguity.
- For who/what/when/where questions, only fill in normalizedClaim if the evidence clearly supports a single answer-backed claim.

Scoring bands:
- 85 to 100: supported
- 70 to 84: likely supported
- 40 to 69: mixed / inconclusive
- 20 to 39: likely unsupported
- 0 to 19: unsupported

Return valid JSON only with exactly this shape:
{
  "normalizedClaim": "string | null",
  "claimSupportScore": 0,
  "confidence": 0,
  "explanation": "string",
  "evidence": [
    {
      "title": "string",
      "url": "string",
      "source": "string",
      "snippet": "string",
      "stance": "supports | contradicts | context"
    }
  ],
  "limitations": ["string"]
}`;

const CLAIM_SEARCH_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'did', 'do', 'does',
  'for', 'from', 'has', 'have', 'how', 'in', 'is', 'it', 'its', 'of', 'on', 'or',
  'pm', 'that', 'the', 'their', 'this', 'to', 'was', 'were', 'what', 'when', 'where',
  'who', 'why', 'with',
]);

function tokenizeClaimSearchText(value) {
  return normalizeClaimWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3 && !CLAIM_SEARCH_STOPWORDS.has(token));
}

function ensureSentence(value) {
  const text = normalizeClaimWhitespace(value).replace(/[.?!]+$/, '');
  return text ? `${text}.` : '';
}

function buildClaimHeadline(value) {
  const text = normalizeClaimWhitespace(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isPrimarySource(source) {
  return PRIMARY_SOURCE_TYPES.has(safeText(source?.sourceType).toLowerCase());
}

function isTrustedSource(source) {
  return TRUSTED_SOURCE_TYPES.has(safeText(source?.sourceType).toLowerCase());
}

function scoreRegistrySourceForClaim(source, claimText) {
  const tokens = tokenizeClaimSearchText(claimText);
  const haystack = normalizeClaimWhitespace([
    source?.sourceName,
    source?.domain,
    source?.country,
    source?.category,
    source?.description,
    source?.editorialNotes,
    Array.isArray(source?.tags) ? source.tags.join(' ') : '',
  ].join(' ')).toLowerCase();

  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += token.length > 5 ? 10 : 7;
    }
  });

  if (isPrimarySource(source)) score += 18;
  else if (safeText(source?.credibilityTier).toLowerCase() === 'very-high') score += 14;
  else if (safeText(source?.credibilityTier).toLowerCase() === 'high') score += 10;

  if (safeText(source?.country).toLowerCase() === 'singapore' && /\bsingapore|lawrence|wong|cpf|hdb|mas|moh\b/i.test(claimText)) {
    score += 10;
  }

  return score;
}

function rankRegistrySourcesForClaim(claimText, sourceRegistry) {
  const sources = Array.isArray(sourceRegistry?.sources) ? sourceRegistry.sources : [];
  return [...sources]
    .map(source => ({ source, score: scoreRegistrySourceForClaim(source, claimText) }))
    .sort((left, right) => {
      const primaryDelta = Number(isPrimarySource(right.source)) - Number(isPrimarySource(left.source));
      if (primaryDelta !== 0) return primaryDelta;
      return right.score - left.score;
    });
}

function decodeDuckDuckGoResultUrl(value) {
  const raw = decodeHtmlEntities(safeText(value)).replace(/&amp;/g, '&');
  if (!raw) return '';

  try {
    const parsed = new URL(raw, 'https://duckduckgo.com');
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
      const target = parsed.searchParams.get('uddg');
      return target ? decodeURIComponent(target) : parsed.toString();
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const anchorPattern = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = anchorPattern.exec(html)) !== null && results.length < (MAX_EVIDENCE_RESULTS * 3)) {
    const tail = html.slice(match.index, match.index + SEARCH_RESULT_WINDOW);
    const snippetMatch = tail.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const url = decodeDuckDuckGoResultUrl(match[1]);
    const title = normalizeClaimWhitespace(stripHtml(match[2]));
    const snippet = normalizeClaimWhitespace(stripHtml(snippetMatch?.[1] || ''));

    if (!url || !title) continue;
    results.push({ title, url, snippet });
  }

  return results;
}

async function searchDuckDuckGo(query) {
  const encodedQuery = encodeURIComponent(normalizeClaimWhitespace(query));
  let lastError = null;

  for (const endpoint of DUCKDUCKGO_SEARCH_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?q=${encodedQuery}`, {
        headers: {
          'User-Agent': SEARCH_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Search request failed (${response.status})`);
      }

      const html = await response.text();
      const results = parseDuckDuckGoResults(html);
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Search retrieval failed.');
}

function sourcePriorityForEvidence(source) {
  if (!source) return 'secondary';
  if (isPrimarySource(source)) return 'official';
  if (isTrustedSource(source)) return 'trusted';
  return 'reputable';
}

function scoreEvidenceCandidate(candidate, claimText) {
  const tokens = tokenizeClaimSearchText(claimText);
  const searchable = normalizeClaimWhitespace([
    candidate?.title,
    candidate?.snippet,
    candidate?.matchedSource?.sourceName,
    candidate?.matchedSource?.domain,
  ].join(' ')).toLowerCase();

  let score = 0;
  tokens.forEach((token) => {
    if (searchable.includes(token)) score += 8;
  });

  if (candidate?.sourcePriority === 'official') score += 28;
  else if (candidate?.sourcePriority === 'trusted') score += 18;
  else if (candidate?.sourcePriority === 'reputable') score += 10;

  return score;
}

function dedupeEvidenceCandidates(candidates) {
  const deduped = [];
  const seen = new Set();

  candidates.forEach((candidate) => {
    const url = canonicalizeUrl(candidate?.url);
    const key = url || normalizeDomain(candidate?.url) || candidate?.title;
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push({ ...candidate, url });
  });

  return deduped;
}

async function searchClaimAcrossSources({ claimText, rankedSources }) {
  const collected = [];
  const triedQueries = new Set();
  const officialSources = rankedSources
    .filter(entry => entry.score > 0 && isPrimarySource(entry.source))
    .slice(0, 3);
  const trustedSources = rankedSources
    .filter(entry => entry.score > 0 && !isPrimarySource(entry.source) && isTrustedSource(entry.source))
    .slice(0, 3);

  const queryPlans = [
    ...officialSources.map(({ source }) => ({
      query: `site:${source.domain} ${claimText}`,
      allowedDomains: [source.domain],
    })),
    ...trustedSources.map(({ source }) => ({
      query: `site:${source.domain} ${claimText}`,
      allowedDomains: [source.domain],
    })),
    {
      query: claimText,
      allowedDomains: [
        ...officialSources.map(item => item.source.domain),
        ...trustedSources.map(item => item.source.domain),
      ],
    },
    {
      query: `${claimText} fact check`,
      allowedDomains: [],
    },
  ];

  for (const plan of queryPlans) {
    if (collected.length >= MAX_EVIDENCE_RESULTS) break;
    const normalizedQuery = normalizeClaimWhitespace(plan.query);
    if (!normalizedQuery || triedQueries.has(normalizedQuery)) continue;
    triedQueries.add(normalizedQuery);

    try {
      const results = await searchDuckDuckGo(normalizedQuery);
      const filtered = [];

      for (const result of results) {
        const domain = extractDomainFromUrl(result.url);
        const matchedSource = await getCredibleSourceByDomain(domain);
        const isSecondary = SECONDARY_EVIDENCE_DOMAINS.has(domain);

        if (Array.isArray(plan.allowedDomains) && plan.allowedDomains.length > 0) {
          const allowed = plan.allowedDomains.some(allowedDomain => (
            domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
          ));
          if (!allowed) continue;
        } else if (!matchedSource && !isSecondary) {
          continue;
        }

        filtered.push({
          ...result,
          domain,
          matchedSource,
          sourcePriority: isSecondary ? 'secondary' : sourcePriorityForEvidence(matchedSource),
        });
      }

      collected.push(...filtered);
    } catch {
      // Continue through the retrieval plan and let the final fallback state explain the failure.
    }
  }

  return dedupeEvidenceCandidates(collected)
    .sort((left, right) => scoreEvidenceCandidate(right, claimText) - scoreEvidenceCandidate(left, claimText))
    .slice(0, MAX_EVIDENCE_RESULTS);
}

async function retrieveEvidenceForClaim({ claimText }) {
  const sourceRegistry = await loadCredibleSources();
  const rankedSources = rankRegistrySourcesForClaim(claimText, sourceRegistry);
  const candidates = await searchClaimAcrossSources({ claimText, rankedSources });

  const enriched = await runWithConcurrency(candidates.slice(0, 4), 2, async (candidate) => {
    const extracted = await extractArticle(candidate.url, {
      title: candidate.title,
      description: candidate.snippet,
      source: candidate.matchedSource?.sourceName || candidate.domain,
    });

    const summary = buildSummaryFromText({
      title: pickFirst(extracted?.title, candidate.title),
      description: pickFirst(extracted?.description, candidate.snippet),
      content: extracted?.content,
    });

    return {
      title: pickFirst(extracted?.title, candidate.title),
      url: candidate.url,
      source: pickFirst(
        candidate.matchedSource?.sourceName,
        extracted?.siteName,
        candidate.domain
      ),
      snippet: pickFirst(summary, candidate.snippet),
      publishedAt: pickFirst(extracted?.publishedAt),
      sourcePriority: candidate.sourcePriority,
      domain: candidate.domain,
      matchedSource: candidate.matchedSource
        ? {
            sourceName: candidate.matchedSource.sourceName,
            domain: candidate.matchedSource.domain,
            sourceType: candidate.matchedSource.sourceType,
            credibilityTier: candidate.matchedSource.credibilityTier,
          }
        : null,
    };
  });

  return {
    rankedSources,
    evidence: dedupeEvidenceCandidates(enriched).slice(0, MAX_EVIDENCE_RESULTS),
  };
}

function buildHeuristicEvidenceJudgment({
  normalizedClaim,
  evidence,
  retrievalFailed = false,
  limitations = [],
}) {
  const claimTokens = tokenizeClaimSearchText(normalizedClaim);
  let supports = 0;
  let contradicts = 0;

  const judgedEvidence = evidence.map((item) => {
    const text = normalizeClaimWhitespace(`${item.title} ${item.snippet}`).toLowerCase();
    const overlap = claimTokens.filter(token => text.includes(token)).length;
    const contradictionMarkers = /\b(false|not true|myth|debunk|incorrect|inaccurate|unsupported|no evidence|is not|are not|was not|were not|did not|does not|has not|have not)\b/i.test(text);
    const supportMarkers = overlap >= Math.max(2, Math.floor(claimTokens.length / 3));

    let stance = 'context';
    if (contradictionMarkers && overlap >= 1) {
      stance = 'contradicts';
      contradicts += 1;
    } else if (supportMarkers) {
      stance = 'supports';
      supports += 1;
    }

    return {
      title: item.title,
      url: item.url,
      source: item.source,
      snippet: item.snippet,
      stance,
    };
  });

  let claimSupportScore = 50;
  if (supports > 0 && contradicts === 0) {
    claimSupportScore = 72 + Math.min(24, (supports * 8));
  } else if (contradicts > 0 && supports === 0) {
    claimSupportScore = Math.max(4, 32 - (contradicts * 10));
  } else if (supports > 0 || contradicts > 0) {
    claimSupportScore = 52 + (supports * 6) - (contradicts * 8);
  } else if (retrievalFailed) {
    claimSupportScore = 50;
  }

  const contradictory = supports > 0 && contradicts > 0;
  const confidence = deriveConfidence({
    evidence: judgedEvidence,
    retrievalFailed,
    contradictory,
    fallback: 46,
  });

  const verdict = verdictFromClaimSupportScore(claimSupportScore);
  let explanation = 'Available evidence is limited, so this remains inconclusive.';
  if (verdict === CLAIM_VERDICTS.SUPPORTED || verdict === CLAIM_VERDICTS.LIKELY_SUPPORTED) {
    explanation = 'Trusted sources generally support this claim.';
  } else if (verdict === CLAIM_VERDICTS.UNSUPPORTED || verdict === CLAIM_VERDICTS.LIKELY_UNSUPPORTED) {
    explanation = 'Trusted sources do not support this claim.';
  } else if (contradictory) {
    explanation = 'Retrieved sources point in different directions, so the evidence is mixed.';
  }

  return {
    normalizedClaim,
    claimSupportScore: clampScore(claimSupportScore, 50),
    confidence,
    explanation,
    evidence: judgedEvidence,
    limitations,
  };
}

async function normalizeQuestionWithEvidenceContext({ question, language, apiKey }) {
  const heuristic = normalizeQuestionToClaimHeuristic(question);
  if (!isOpenAiConfigured(apiKey)) return heuristic;

  try {
    const response = await requestOpenAIJson({
      apiKey,
      systemPrompt: QUESTION_NORMALIZATION_PROMPT,
      maxTokens: 220,
      payload: {
        preferredOutputLanguage: safeText(language, 'en'),
        preferredOutputLanguageName: resolveOutputLanguageName(language),
        question,
      },
    });

    return {
      normalizedClaim: safeText(response?.normalizedClaim) || heuristic.normalizedClaim || null,
      needsAnswerFromEvidence: Boolean(response?.needsAnswerFromEvidence ?? heuristic.needsAnswerFromEvidence),
      claimTemplate: safeText(response?.claimTemplate) || heuristic.claimTemplate || null,
      ambiguity: safeText(response?.ambiguity) || null,
    };
  } catch {
    return heuristic;
  }
}

async function extractArticleClaims({ article, language, apiKey }) {
  const fallbackClaims = [
    buildClaimHeadline(pickFirst(article?.title, article?.description)),
    buildClaimHeadline(article?.summary),
  ].filter(Boolean).slice(0, 2);

  if (!isOpenAiConfigured(apiKey)) {
    return fallbackClaims.slice(0, MAX_CLAIMS_TO_CHECK);
  }

  try {
    const response = await requestOpenAIJson({
      apiKey,
      systemPrompt: ARTICLE_CLAIM_EXTRACTION_PROMPT,
      maxTokens: 260,
      payload: {
        preferredOutputLanguage: safeText(language, 'en'),
        preferredOutputLanguageName: resolveOutputLanguageName(language),
        headline: safeText(article?.title),
        sourceName: safeText(article?.source),
        description: safeText(article?.description),
        summary: safeText(article?.summary),
        fullBodyText: safeText(article?.content || article?.scrapedContent).slice(0, MAX_BODY_CHARACTERS),
      },
    });

    const claims = Array.isArray(response?.claims)
      ? response.claims.map(item => ensureSentence(item)).filter(Boolean)
      : [];

    return claims.length > 0
      ? claims.slice(0, MAX_CLAIMS_TO_CHECK)
      : fallbackClaims.slice(0, MAX_CLAIMS_TO_CHECK);
  } catch {
    return fallbackClaims.slice(0, MAX_CLAIMS_TO_CHECK);
  }
}

async function synthesizeClaimSupport({
  originalInput,
  inputType,
  questionContext,
  normalizedClaim,
  evidence,
  language,
  apiKey,
  limitations = [],
}) {
  if (evidence.length === 0) {
    return buildHeuristicEvidenceJudgment({
      normalizedClaim,
      evidence: [],
      retrievalFailed: true,
      limitations: [
        ...limitations,
        'Trusted-source retrieval did not return enough usable evidence.',
      ],
    });
  }

  if (!isOpenAiConfigured(apiKey)) {
    return buildHeuristicEvidenceJudgment({
      normalizedClaim,
      evidence,
      retrievalFailed: false,
      limitations,
    });
  }

  try {
    const response = await requestOpenAIJson({
      apiKey,
      systemPrompt: EVIDENCE_SYNTHESIS_PROMPT,
      maxTokens: 900,
      payload: {
        preferredOutputLanguage: safeText(language, 'en'),
        preferredOutputLanguageName: resolveOutputLanguageName(language),
        inputType,
        originalInput,
        questionContext: questionContext || null,
        normalizedClaim: normalizedClaim || null,
        evidencePack: evidence,
        limitations,
      },
    });

    return buildClaimCheckResult({
      inputType,
      originalInput,
      normalizedClaim: safeText(response?.normalizedClaim) || normalizedClaim || null,
      claimSupportScore: clampScore(response?.claimSupportScore, 50),
      confidence: clampScore(response?.confidence, 45),
      explanation: safeText(response?.explanation) || 'Available evidence is mixed.',
      evidence: Array.isArray(response?.evidence) && response.evidence.length > 0
        ? response.evidence
        : evidence,
      limitations: Array.isArray(response?.limitations)
        ? [...limitations, ...response.limitations]
        : limitations,
    });
  } catch {
    return buildHeuristicEvidenceJudgment({
      normalizedClaim,
      evidence,
      retrievalFailed: false,
      limitations: [
        ...limitations,
        'Model-based evidence synthesis was unavailable, so a heuristic fallback was used.',
      ],
    });
  }
}

function deriveSourceCredibilityScore(localAssessment, credibleSourceSimilarity) {
  const baseline = clampScore(localAssessment?.credibilityDetail?.credibilityScore, 50);
  const similarityScore = clampScore(credibleSourceSimilarity?.similarityScore, baseline);

  if (credibleSourceSimilarity?.exactDomainMatch) {
    return clampScore(Math.round((baseline * 0.7) + (similarityScore * 0.3)), baseline);
  }

  if (credibleSourceSimilarity?.status === 'ready' && similarityScore > baseline) {
    return clampScore(Math.round((baseline * 0.8) + (similarityScore * 0.2)), baseline);
  }

  return baseline;
}

function buildSourceCredibilityExplanation(score) {
  if (score >= 75) {
    return 'This source appears reputable, but individual claims should still be checked.';
  }
  if (score <= 39) {
    return 'This source appears weak, but some claims may still be accurate.';
  }
  return 'This source has mixed reputation signals, so claim-level evidence matters more than the domain alone.';
}

function buildNextStepForVerdict(verdict, inputType) {
  if (verdict === CLAIM_VERDICTS.SUPPORTED || verdict === CLAIM_VERDICTS.LIKELY_SUPPORTED) {
    return inputType === CLAIM_INPUT_TYPES.URL_ARTICLE
      ? 'This source may be usable, but verify any high-stakes claims directly with primary sources.'
      : 'Evidence suggests this claim is supported, but check primary sources for high-stakes decisions.';
  }

  if (verdict === CLAIM_VERDICTS.UNSUPPORTED || verdict === CLAIM_VERDICTS.LIKELY_UNSUPPORTED) {
    return 'Available evidence does not support this claim. Verify against official or primary sources before sharing it.';
  }

  return 'Evidence is mixed or incomplete. Look for additional official or primary sources before relying on this.';
}

function createSearchResultEnvelope({
  baseResult,
  detectedLanguage,
  originalInput,
  originalClaim,
  headline = '',
  articleSummary = '',
  sourceCredibilityExplanation = '',
  checkedClaims = [],
  credibleSourceSimilarity = null,
  sourceDetails = null,
}) {
  const legacyCredibility = legacyCredibilityFromVerdict(baseResult.verdict);

  return {
    ...baseResult,
    detectedLanguage,
    originalInput,
    originalClaim,
    headline,
    articleSummary,
    sourceCredibilityExplanation,
    recommendedNextStep: buildNextStepForVerdict(baseResult.verdict, baseResult.inputType),
    checkedClaims,
    sourceDetails,
    credibleSourceSimilarity,
    credibility: legacyCredibility,
    appCredibility: legacyCredibility,
    score: baseResult.claimSupportScore,
    confidenceScore: baseResult.confidence,
  };
}

async function analyzeClaimLikeInput({
  originalInput,
  inputType,
  language,
  apiKey,
  fileName,
  hasUserText = true,
}) {
  const questionNormalization = inputType === CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION
    ? await normalizeQuestionWithEvidenceContext({
      question: originalInput,
      language,
      apiKey,
    })
    : null;
  const screenshotWithoutText = inputType === CLAIM_INPUT_TYPES.SCREENSHOT_OR_EXTRACTED_TEXT
    && !hasUserText;

  const normalizedClaim = inputType === CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION
    ? questionNormalization?.normalizedClaim
    : screenshotWithoutText
      ? null
      : ensureSentence(originalInput);

  const retrievalQuery = normalizeClaimWhitespace(
    normalizedClaim
    || originalInput
    || fileName
  );
  const retrieval = screenshotWithoutText
    ? { evidence: [] }
    : await retrieveEvidenceForClaim({ claimText: retrievalQuery });
  const limitations = [];

  if (inputType === CLAIM_INPUT_TYPES.SCREENSHOT_OR_EXTRACTED_TEXT) {
    limitations.push('This input came from the screenshot / extracted-text flow. OCR quality or missing context may affect the result.');
    if (screenshotWithoutText) {
      limitations.push('No extracted text was available, so the screenshot could not be turned into a checkable claim.');
    }
  }

  if (questionNormalization?.ambiguity) {
    limitations.push(questionNormalization.ambiguity);
  }

  const synthesized = await synthesizeClaimSupport({
    originalInput,
    inputType,
    questionContext: inputType === CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION ? originalInput : null,
    normalizedClaim,
    evidence: retrieval.evidence,
    language,
    apiKey,
    limitations,
  });

  const result = buildClaimCheckResult({
    ...synthesized,
    inputType,
    originalInput,
    normalizedClaim: synthesized.normalizedClaim || normalizedClaim,
  });

  return createSearchResultEnvelope({
    baseResult: result,
    detectedLanguage: detectLanguage(originalInput),
    originalInput,
    originalClaim: originalInput,
    headline: buildClaimHeadline(result.normalizedClaim || originalInput),
    articleSummary: '',
    sourceCredibilityExplanation: '',
    checkedClaims: result.normalizedClaim ? [{ claim: result.normalizedClaim, score: result.claimSupportScore }] : [],
    credibleSourceSimilarity: null,
    sourceDetails: null,
  });
}

async function analyzeUrlArticleInput({
  sourceUrl,
  language,
  apiKey,
}) {
  const extracted = await extractArticle(sourceUrl, {
    title: '',
    description: '',
    source: '',
    publishedAt: '',
    imageUrl: '',
    author: '',
  });

  const articleShell = {
    title: extracted?.title,
    description: extracted?.description,
    source: extracted?.siteName,
    url: sourceUrl,
    originalUrl: sourceUrl,
    publishedAt: extracted?.publishedAt,
    content: extracted?.content,
    scrapedContent: extracted?.content,
  };

  const articleSummary = buildSummaryFromText({
    title: extracted?.title,
    description: extracted?.description,
    content: extracted?.content,
  });

  const sourceRegistry = await loadCredibleSources();
  const localAssessment = buildInitialArticleCredibility(articleShell, sourceRegistry);

  let credibleSourceSimilarity = null;
  try {
    credibleSourceSimilarity = await evaluateCredibleSourceSimilarity({
      title: extracted?.title || '',
      source: extracted?.siteName || '',
      url: sourceUrl,
      originalUrl: sourceUrl,
      summary: articleSummary,
      description: extracted?.description || '',
      scrapedContent: extracted?.content || '',
      requestedLanguage: language,
    });
  } catch (error) {
    credibleSourceSimilarity = buildUnavailableSourceSimilarity(error?.message || 'Credible source similarity unavailable.');
  }

  const sourceCredibilityScore = deriveSourceCredibilityScore(localAssessment, credibleSourceSimilarity);
  const checkedClaims = [];
  const claims = await extractArticleClaims({
    article: {
      ...articleShell,
      summary: articleSummary,
    },
    language,
    apiKey,
  });

  for (const claim of claims) {
    const retrieval = await retrieveEvidenceForClaim({ claimText: claim });
    const synthesized = await synthesizeClaimSupport({
      originalInput: sourceUrl,
      inputType: CLAIM_INPUT_TYPES.URL_ARTICLE,
      questionContext: null,
      normalizedClaim: claim,
      evidence: retrieval.evidence,
      language,
      apiKey,
      limitations: [],
    });

    checkedClaims.push({
      claim,
      score: clampScore(synthesized.claimSupportScore, 50),
      verdict: verdictFromClaimSupportScore(synthesized.claimSupportScore),
      evidence: Array.isArray(synthesized.evidence) ? synthesized.evidence.slice(0, 3) : [],
      explanation: synthesized.explanation,
    });
  }

  const aggregateSupportScore = checkedClaims.length > 0
    ? clampScore(Math.round(
      checkedClaims.reduce((total, item) => total + item.score, 0) / checkedClaims.length
    ), 50)
    : 50;
  const aggregateConfidence = deriveConfidence({
    evidence: checkedClaims.flatMap(item => item.evidence || []).slice(0, MAX_EVIDENCE_RESULTS),
    retrievalFailed: checkedClaims.length === 0,
    contradictory: checkedClaims.some(item => item.verdict === CLAIM_VERDICTS.LIKELY_UNSUPPORTED || item.verdict === CLAIM_VERDICTS.UNSUPPORTED)
      && checkedClaims.some(item => item.verdict === CLAIM_VERDICTS.SUPPORTED || item.verdict === CLAIM_VERDICTS.LIKELY_SUPPORTED),
    fallback: 48,
  });

  const allEvidence = dedupeEvidenceCandidates(
    checkedClaims.flatMap(item => item.evidence || [])
  ).slice(0, MAX_EVIDENCE_RESULTS);

  const limitations = [];
  if (!extracted?.success) {
    limitations.push('Full article extraction was incomplete, so the article claims may not have been fully captured.');
  }
  if (checkedClaims.length === 0) {
    limitations.push('No clear article claims were extracted for external verification.');
  }

  const baseResult = buildClaimCheckResult({
    inputType: CLAIM_INPUT_TYPES.URL_ARTICLE,
    originalInput: sourceUrl,
    normalizedClaim: null,
    sourceCredibilityScore,
    claimSupportScore: aggregateSupportScore,
    confidence: aggregateConfidence,
    explanation: checkedClaims.length > 0
      ? checkedClaims[0].explanation
      : 'The article source could be assessed, but evidence retrieval for its main claims was limited.',
    evidence: allEvidence,
    limitations,
  });

  return createSearchResultEnvelope({
    baseResult,
    detectedLanguage: detectLanguage(`${extracted?.title || ''} ${extracted?.content || ''}`),
    originalInput: sourceUrl,
    originalClaim: sourceUrl,
    headline: extracted?.title || sourceUrl,
    articleSummary,
    sourceCredibilityExplanation: buildSourceCredibilityExplanation(sourceCredibilityScore),
    checkedClaims,
    credibleSourceSimilarity,
    sourceDetails: {
      domain: normalizeDomain(sourceUrl),
      sourceName: pickFirst(extracted?.siteName, normalizeDomain(sourceUrl)),
    },
  });
}

export async function analyzeSearchInput({ text = '', url = '', language = 'en', fileName = '', apiKey }) {
  if (!safeText(text) && !safeText(url) && !safeText(fileName)) {
    throw new Error('A claim, URL, or file name is required.');
  }

  const typedText = safeText(text);
  const detectedUrl = safeText(url) || extractFirstUrl(typedText);
  const inputType = detectClaimInputType({
    text: typedText,
    url: detectedUrl,
    fileName,
    fromScreenshot: Boolean(fileName),
  });
  const originalInput = inputType === CLAIM_INPUT_TYPES.URL_ARTICLE
    ? detectedUrl
    : typedText || fileName;

  const cacheKey = `search:${CREDIBILITY_OUTPUT_VERSION}:${hashText(JSON.stringify({
    inputType,
    originalInput,
    language,
    fileName,
  }))}`;
  const cached = readTimedCache(searchCredibilityCache, cacheKey, CREDIBILITY_CACHE_TTL_MS);
  if (cached) return cached;

  const result = inputType === CLAIM_INPUT_TYPES.URL_ARTICLE
    ? await analyzeUrlArticleInput({
      originalInput,
      sourceUrl: detectedUrl,
      language,
      apiKey,
    })
    : await analyzeClaimLikeInput({
      originalInput,
      inputType,
      language,
      apiKey,
      fileName,
      hasUserText: Boolean(typedText),
    });

  writeTimedCache(searchCredibilityCache, cacheKey, result);
  return result;
}

async function enrichOneArticle(article, { apiKey, language }) {
  const identity = getArticleIdentity(article);
  const sourceRegistry = await loadCredibleSources();
  const localAssessment = buildInitialArticleCredibility(article, sourceRegistry);
  const localContentFingerprint = buildArticleFingerprint({
    ...article,
    credibilityDetail: localAssessment.credibilityDetail,
  });
  const localCacheKey = `article:${CREDIBILITY_OUTPUT_VERSION}:${identity}|${safeText(language, 'en')}|${localContentFingerprint}`;
  const cachedLocal = readTimedCache(articleCredibilityCache, localCacheKey, CREDIBILITY_CACHE_TTL_MS);
  if (cachedLocal) {
    return {
      ...article,
      ...cachedLocal,
    };
  }

  if (!localAssessment.credibilityNeedsRefinement) {
    const immediateArticle = mergeLocalAssessment(article, localAssessment, {
      credibilityNeedsRefinement: false,
    });
    writeTimedCache(articleCredibilityCache, localCacheKey, immediateArticle);
    return immediateArticle;
  }

  const shouldExtractRemote = Boolean(article?.isFromLiveApi);
  const extracted = shouldExtractRemote
    ? await extractArticle(article.url || article.originalUrl, {
      title: article.title,
      description: article.description,
      source: article.source,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
      author: article.author,
    })
    : createSyntheticExtraction(article);
  const baseArticle = mergeLocalAssessment(article, localAssessment, {
    canonicalUrl: pickFirst(extracted.canonicalUrl, canonicalizeUrl(article.url || article.originalUrl)),
    title: pickFirst(article.title, extracted.title),
    description: pickFirst(article.description, extracted.description),
    source: pickFirst(article.source, extracted.siteName, 'Unknown source'),
    author: pickFirst(article.author, extracted.author),
    publishedAt: pickFirst(article.publishedAt, extracted.publishedAt),
    imageUrl: pickFirst(article.imageUrl, extracted.imageUrl),
    scrapedContent: pickFirst(extracted.content, article.scrapedContent, article.content),
  });

  const articleSummary = buildSummaryFromText({
    title: pickFirst(baseArticle.title, extracted.title),
    description: pickFirst(baseArticle.description, extracted.description),
    content: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
  });
  const contentFingerprint = buildArticleFingerprint(baseArticle, extracted);
  const cacheKey = `article:${CREDIBILITY_OUTPUT_VERSION}:${identity}|${safeText(language, 'en')}|${contentFingerprint}`;
  const cached = readTimedCache(articleCredibilityCache, cacheKey, CREDIBILITY_CACHE_TTL_MS);
  if (cached) {
    return {
      ...baseArticle,
      ...cached,
    };
  }

  let credibleSourceSimilarity = null;
  try {
    credibleSourceSimilarity = await evaluateCredibleSourceSimilarity({
      ...baseArticle,
      title: pickFirst(baseArticle.title, extracted.title),
      source: pickFirst(baseArticle.source, extracted.siteName),
      sourceUrl: pickFirst(baseArticle.sourceUrl, article.sourceUrl),
      url: pickFirst(baseArticle.url, baseArticle.originalUrl),
      originalUrl: pickFirst(baseArticle.originalUrl, baseArticle.url),
      publishedAt: pickFirst(baseArticle.publishedAt, extracted.publishedAt),
      category: safeText(baseArticle.category),
      summary: articleSummary,
      description: pickFirst(baseArticle.description, extracted.description),
      scrapedContent: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
      requestedLanguage: safeText(language, baseArticle.requestedLanguage || 'en'),
    });
  } catch (error) {
    credibleSourceSimilarity = buildUnavailableSourceSimilarity(error?.message || 'Credible source similarity unavailable.');
  }

  if (!shouldCallOpenAi(localAssessment, credibleSourceSimilarity)) {
    const stagedArticle = mergeLocalAssessment(baseArticle, localAssessment, {
      summary: articleSummary || baseArticle.summary,
      scrapedContent: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
      credibleSourceSimilarity: credibleSourceSimilarity || localAssessment.credibleSourceSimilarity,
      credibilityNeedsRefinement: false,
      credibilityStage: credibleSourceSimilarity?.status === 'ready' ? 'similarity' : 'local',
    });
    writeTimedCache(articleCredibilityCache, cacheKey, stagedArticle);
    return stagedArticle;
  }

  if (!isOpenAiConfigured(apiKey)) {
    const stagedArticle = mergeLocalAssessment(baseArticle, localAssessment, {
      summary: articleSummary || baseArticle.summary,
      scrapedContent: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
      credibleSourceSimilarity: credibleSourceSimilarity || localAssessment.credibleSourceSimilarity,
      credibilityNeedsRefinement: false,
      credibilityStage: credibleSourceSimilarity?.status === 'ready' ? 'similarity' : 'local',
      credibilityError: 'OpenAI API key not configured.',
    });
    writeTimedCache(articleCredibilityCache, cacheKey, stagedArticle);
    return stagedArticle;
  }

  const fallback = {
    headline: pickFirst(article.title, extracted.title),
    articleSummary,
  };

  try {
    const analysis = await callOpenAIJson({
      apiKey,
      fallback,
      payload: {
        mode: 'article',
        preferredOutputLanguage: safeText(language, 'en'),
        preferredOutputLanguageName: resolveOutputLanguageName(language),
        article: {
          headline: pickFirst(baseArticle.title, extracted.title),
          sourceName: pickFirst(baseArticle.source, extracted.siteName),
          originalArticleUrl: pickFirst(baseArticle.url, baseArticle.originalUrl),
          publishDate: pickFirst(baseArticle.publishedAt, extracted.publishedAt),
          category: safeText(baseArticle.category),
          articleSummary,
          fullBodyText: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
        },
        instructions: 'Assess the credibility of this scraped article. Base the assessment on the article body, metadata, source, and framing.',
      },
    });

    const enrichment = {
      canonicalUrl: pickFirst(extracted.canonicalUrl, canonicalizeUrl(baseArticle.url || baseArticle.originalUrl)),
      title: pickFirst(baseArticle.title, extracted.title),
      description: pickFirst(baseArticle.description, extracted.description),
      source: pickFirst(baseArticle.source, extracted.siteName, 'Unknown source'),
      author: pickFirst(baseArticle.author, extracted.author),
      publishedAt: pickFirst(baseArticle.publishedAt, extracted.publishedAt),
      imageUrl: pickFirst(baseArticle.imageUrl, extracted.imageUrl),
      summary: analysis.articleSummary || articleSummary,
      scrapedContent: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
      credibilityStatus: 'ready',
      credibility: analysis.appCredibility || verdictToAppCredibility(analysis.verdict),
      credibilityAnalysis: buildArticleCredibilityObject(analysis),
      credibilityDetail: analysis,
      credibilityError: '',
      credibilityNeedsRefinement: false,
      credibilityStage: 'deep',
      lastEvaluatedAt: new Date().toISOString(),
      credibleSourceSimilarity: credibleSourceSimilarity || buildUnavailableSourceSimilarity('Credible source similarity unavailable.'),
    };

    writeTimedCache(articleCredibilityCache, cacheKey, enrichment);
    return {
      ...baseArticle,
      ...enrichment,
    };
  } catch (error) {
    const stagedArticle = mergeLocalAssessment(baseArticle, localAssessment, {
      summary: articleSummary || baseArticle.summary,
      scrapedContent: pickFirst(extracted.content, baseArticle.scrapedContent, baseArticle.content),
      credibleSourceSimilarity: credibleSourceSimilarity || localAssessment.credibleSourceSimilarity,
      credibilityNeedsRefinement: false,
      credibilityStage: credibleSourceSimilarity?.status === 'ready' ? 'similarity' : 'local',
      credibilityError: error?.message || 'Credibility assessment unavailable.',
    });
    writeTimedCache(articleCredibilityCache, cacheKey, stagedArticle);
    return stagedArticle;
  }
}

export async function assessOpenedArticle(article, { apiKey, language = 'en' } = {}) {
  if (!article || typeof article !== 'object') {
    throw new Error('An article payload is required.');
  }

  return enrichOneArticle(article, { apiKey, language });
}

export async function enrichArticlesWithCredibility(articles, { apiKey, language = 'en' } = {}) {
  const safeArticles = Array.isArray(articles) ? articles.filter(Boolean) : [];
  if (safeArticles.length === 0) return [];

  return runWithConcurrency(safeArticles, 3, async (article) => {
    const hasUrl = Boolean(safeText(article?.url || article?.originalUrl));
    const isLiveArticle = Boolean(article?.isFromLiveApi);

    if (!hasUrl || !isLiveArticle) {
      const summary = safeText(article?.summary) || buildSummaryFromText({
        title: article?.title,
        description: article?.description,
        content: article?.content,
      });

      return {
        ...article,
        canonicalUrl: canonicalizeUrl(article?.url || article?.originalUrl),
        summary,
        scrapedContent: pickFirst(article?.scrapedContent, article?.content),
        credibilityStatus: article?.credibilityStatus || 'ready',
      };
    }

    return enrichOneArticle(article, { apiKey, language });
  });
}
