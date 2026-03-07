import { readFile } from 'node:fs/promises';

const CREDIBLE_SOURCES_FILE_URL = new URL('../data/credibleSources.json', import.meta.url);
const MAX_ARTICLE_COMPARISON_CHARACTERS = 6_000;

let cachedSources = null;
let cachedDomainMap = null;

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function ensureArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => normalizeWhitespace(item))
    .filter(Boolean);
}

function buildDomainCandidates(value) {
  const domain = normalizeDomain(value);
  if (!domain) return [];

  const parts = domain.split('.').filter(Boolean);
  const candidates = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    const candidate = parts.slice(index).join('.');
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function normalizeDomain(value) {
  const raw = safeText(value).toLowerCase();
  if (!raw) return '';

  try {
    const candidate = raw.includes('://') ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    return parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
  } catch {
    return raw
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .trim();
  }
}

export function extractDomainFromUrl(value) {
  return normalizeDomain(value);
}

function normalizeSourceRecord(rawSource) {
  const domain = normalizeDomain(rawSource?.domain);
  return {
    id: safeText(rawSource?.id, domain || 'unknown-source'),
    sourceName: normalizeWhitespace(rawSource?.sourceName),
    domain,
    country: normalizeWhitespace(rawSource?.country),
    language: normalizeWhitespace(rawSource?.language, 'multilingual'),
    category: normalizeWhitespace(rawSource?.category),
    sourceType: normalizeWhitespace(rawSource?.sourceType),
    credibilityTier: normalizeWhitespace(rawSource?.credibilityTier, 'medium'),
    description: normalizeWhitespace(rawSource?.description),
    editorialNotes: normalizeWhitespace(rawSource?.editorialNotes),
    tags: ensureArrayOfStrings(rawSource?.tags),
    exampleHeadlines: ensureArrayOfStrings(rawSource?.exampleHeadlines),
    lastReviewedAt: normalizeWhitespace(rawSource?.lastReviewedAt),
  };
}

async function hydrateCredibleSources() {
  if (cachedSources && cachedDomainMap) return;

  const fileContents = await readFile(CREDIBLE_SOURCES_FILE_URL, 'utf8');
  const parsed = JSON.parse(fileContents);
  if (!Array.isArray(parsed)) {
    throw new Error('credibleSources.json must contain an array of source records.');
  }

  const sources = parsed.map(normalizeSourceRecord).filter(source => source.id && source.domain);
  const domainMap = new Map();

  sources.forEach((source) => {
    domainMap.set(source.domain, source);
  });

  cachedSources = sources;
  cachedDomainMap = domainMap;
}

export async function loadCredibleSources() {
  await hydrateCredibleSources();
  return cachedSources;
}

export async function getCredibleSourceByDomain(domainOrUrl) {
  await hydrateCredibleSources();

  const candidates = buildDomainCandidates(domainOrUrl);
  for (const candidate of candidates) {
    const matchedSource = cachedDomainMap.get(candidate);
    if (matchedSource) return matchedSource;
  }

  return null;
}

export function buildSourceProfileText(source) {
  const normalizedSource = normalizeSourceRecord(source);
  return [
    `Source name: ${normalizedSource.sourceName}`,
    `Domain: ${normalizedSource.domain}`,
    `Source type: ${normalizedSource.sourceType}`,
    `Credibility tier: ${normalizedSource.credibilityTier}`,
    `Country: ${normalizedSource.country}`,
    `Primary language: ${normalizedSource.language}`,
    `Category: ${normalizedSource.category}`,
    `Description: ${normalizedSource.description}`,
    `Editorial notes: ${normalizedSource.editorialNotes}`,
    normalizedSource.tags.length ? `Tags: ${normalizedSource.tags.join(', ')}` : '',
    normalizedSource.exampleHeadlines.length
      ? `Example headlines: ${normalizedSource.exampleHeadlines.join(' | ')}`
      : '',
  ].filter(Boolean).join('\n');
}

export function buildArticleComparisonText(article) {
  const title = normalizeWhitespace(article?.title || article?.headline);
  const sourceName = normalizeWhitespace(article?.source || article?.sourceName);
  const domain = normalizeDomain(
    article?.domain
    || article?.sourceUrl
    || article?.url
    || article?.originalUrl
    || article?.canonicalUrl
  );
  const category = normalizeWhitespace(article?.category || article?.topic);
  const language = normalizeWhitespace(article?.requestedLanguage || article?.language);
  const summary = normalizeWhitespace(article?.summary || article?.description);
  const bodyText = normalizeWhitespace(article?.scrapedContent || article?.fullBodyText || article?.content);
  const publishedAt = normalizeWhitespace(article?.publishedAt || article?.publishDate);

  const combined = [
    title ? `Headline: ${title}` : '',
    sourceName ? `Source name: ${sourceName}` : '',
    domain ? `Source domain: ${domain}` : '',
    category ? `Topic/category: ${category}` : '',
    language ? `Language: ${language}` : '',
    publishedAt ? `Published at: ${publishedAt}` : '',
    summary ? `Summary: ${summary}` : '',
    bodyText ? `Body text: ${bodyText}` : '',
  ].filter(Boolean).join('\n');

  if (combined.length <= MAX_ARTICLE_COMPARISON_CHARACTERS) {
    return combined;
  }

  return `${combined.slice(0, MAX_ARTICLE_COMPARISON_CHARACTERS - 3).trim()}...`;
}
