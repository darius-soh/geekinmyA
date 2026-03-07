import {
  ALL_ARTICLE_CATEGORIES,
  NEWS_CATEGORIES,
  articles as rawArticles,
} from '../data/articles';
import articleTranslations from '../data/articleTranslations';
import credibleSources from '../../data/credibleSources.json';
import {
  buildInitialArticleCredibility,
  buildSourceRegistryIndex,
} from '../../shared/sourceRegistryAssessment.js';

const sourceRegistry = buildSourceRegistryIndex(credibleSources);
const SUPPORTED_CONTENT_LANGUAGES = ['en', 'zh', 'ms', 'ta'];
const LOCALIZED_FIELDS = ['title', 'shortDescription', 'description', 'summary', 'content'];

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeCategory(value) {
  const normalized = safeText(value).toLowerCase();
  return ALL_ARTICLE_CATEGORIES.includes(normalized) ? normalized : 'world';
}

function normalizePublishedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '2026-03-01T00:00:00Z';
  }
  return date.toISOString();
}

function isPlaceholderAsset(value) {
  return /^ADD_[A-Z0-9_]+$/i.test(safeText(value));
}

function normalizeOptionalUrl(value) {
  const raw = safeText(value);
  if (!raw || isPlaceholderAsset(raw)) return '';

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function looksLikeUrl(value) {
  const raw = safeText(value);
  return /^https?:\/\//i.test(raw);
}

function deriveSourceName(article) {
  const rawSource = safeText(article?.source);
  if (rawSource && !looksLikeUrl(rawSource)) {
    return rawSource;
  }

  const sourceUrl = normalizeOptionalUrl(article?.sourceUrl || rawSource);
  if (!sourceUrl) return 'ADD_SOURCE_HERE';

  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'ADD_SOURCE_HERE';
  }
}

function normalizeImage(value) {
  const raw = safeText(value);
  if (!raw || isPlaceholderAsset(raw)) return '';
  return raw;
}

function resolveTranslationValue(article, overlay, language, field) {
  return safeText(
    overlay?.[language]?.[field]
    || article?.translations?.[language]?.[field]
    || article?.[`${field}_${language}`]
  );
}

function extractTranslations(article) {
  const overlay = articleTranslations[safeText(article?.id)] || {};
  const translations = {};

  SUPPORTED_CONTENT_LANGUAGES.forEach((language) => {
    const entry = {};

    LOCALIZED_FIELDS.forEach((field) => {
      const value = resolveTranslationValue(article, overlay, language, field);
      if (value) {
        entry[field] = value;
      }
    });

    if (Object.keys(entry).length > 0) {
      translations[language] = entry;
    }
  });

  return translations;
}

function flattenTranslations(translations) {
  return Object.entries(translations).reduce((accumulator, [language, entry]) => {
    Object.entries(entry).forEach(([field, value]) => {
      accumulator[`${field}_${language}`] = value;
    });
    return accumulator;
  }, {});
}

function resolveBaseContentField(article, translations, field) {
  const directValue = safeText(article?.[field]);
  const translatedEnglishValue = safeText(translations?.en?.[field]);
  return directValue || translatedEnglishValue;
}

function applyRequestedLanguage(article, language) {
  if (!language) return article;
  return {
    ...article,
    requestedLanguage: safeText(language, article.requestedLanguage || 'en'),
  };
}

function getLocalizedHaystackValues(article) {
  const values = [
    article.title,
    article.source,
    article.shortDescription,
    article.description,
    article.summary,
    article.category,
  ];

  Object.values(article?.translations || {}).forEach((entry) => {
    LOCALIZED_FIELDS.forEach((field) => {
      values.push(entry?.[field]);
    });
  });

  return values.filter(Boolean);
}

function pickLocalizedArticleFields(article) {
  const flattenedTranslations = flattenTranslations(article?.translations || {});
  return {
    translations: article?.translations || {},
    ...flattenedTranslations,
  };
}

function normalizeArticle(article) {
  const link = normalizeOptionalUrl(article?.link);
  const sourceUrl = normalizeOptionalUrl(article?.sourceUrl || article?.source);
  const translations = extractTranslations(article);
  const shortDescription = resolveBaseContentField(article, translations, 'shortDescription');
  const description = resolveBaseContentField(article, translations, 'description') || shortDescription;
  const summary = resolveBaseContentField(article, translations, 'summary') || description;
  const content = resolveBaseContentField(article, translations, 'content') || summary || description;
  const originalLanguage = safeText(article?.originalLanguage || article?.language, 'en');
  const normalizedArticle = {
    id: safeText(article?.id),
    category: normalizeCategory(article?.category),
    image: normalizeImage(article?.image),
    imageUrl: normalizeImage(article?.image),
    source: deriveSourceName(article),
    sourceUrl,
    title: resolveBaseContentField(article, translations, 'title') || 'ADD_TITLE_HERE',
    shortDescription,
    description: description || 'ADD_SHORT_DESCRIPTION_HERE',
    summary: summary || 'ADD_SUMMARY_HERE',
    content: content || 'ADD_SUMMARY_HERE',
    publishedAt: normalizePublishedAt(article?.publishedAt),
    link,
    url: link,
    originalUrl: link,
    canonicalUrl: link,
    originalLanguage,
    requestedLanguage: safeText(article?.requestedLanguage, originalLanguage),
    isFromLiveApi: false,
    translations,
    ...flattenTranslations(translations),
  };

  return {
    ...normalizedArticle,
    ...buildInitialArticleCredibility(normalizedArticle, sourceRegistry),
  };
}

const normalizedArticles = rawArticles.map(normalizeArticle);
const articlesById = new Map(normalizedArticles.map(article => [article.id, article]));

function sortByPublishedDate(articles) {
  return [...articles].sort((left, right) => (
    new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  ));
}

export function getAllArticles() {
  return normalizedArticles;
}

export { NEWS_CATEGORIES };

export function getTrendingArticles(options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : normalizedArticles.length;
  return sortByPublishedDate(normalizedArticles)
    .filter(article => NEWS_CATEGORIES.includes(article.category))
    .map(article => applyRequestedLanguage(article, options.language))
    .slice(0, limit);
}

export function getArticlesByCategory(category, options = {}) {
  const normalizedCategory = normalizeCategory(category);
  const limit = Number(options.limit) > 0 ? Number(options.limit) : normalizedArticles.length;

  return sortByPublishedDate(
    normalizedArticles.filter(article => article.category === normalizedCategory)
  )
    .map(article => applyRequestedLanguage(article, options.language))
    .slice(0, limit);
}

export function getArticleById(id, options = {}) {
  const article = articlesById.get(safeText(id)) || null;
  return article ? applyRequestedLanguage(article, options.language) : null;
}

export function searchArticles(query, options = {}) {
  const normalizedQuery = safeText(query).toLowerCase();
  const limit = Number(options.limit) > 0 ? Number(options.limit) : normalizedArticles.length;
  if (!normalizedQuery) return [];

  return sortByPublishedDate(
    normalizedArticles.filter((article) => {
      const haystack = getLocalizedHaystackValues(article)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
  )
    .map(article => applyRequestedLanguage(article, options.language))
    .slice(0, limit);
}

function buildHotTopicType(index) {
  if (index % 3 === 0) return 'trending';
  if (index % 3 === 1) return 'developing';
  return 'caution';
}

export function getHotTopics(options = {}) {
  const excludedArticleIds = new Set(Array.isArray(options.excludedArticleIds) ? options.excludedArticleIds : []);
  const selected = [];
  const seenCategories = new Set();

  sortByPublishedDate(normalizedArticles).forEach((article) => {
    if (selected.length >= 6) return;
    if (excludedArticleIds.has(article.id)) return;
    if (seenCategories.has(article.category)) return;
    if (!NEWS_CATEGORIES.includes(article.category)) return;

    seenCategories.add(article.category);
    selected.push(article);
  });

  return selected.map((article, index) => ({
    id: `hot-${article.id}`,
    title: article.title,
    shortDescription: article.shortDescription,
    description: article.shortDescription || article.summary,
    source: article.source,
    sourceUrl: article.sourceUrl,
    publishedAt: article.publishedAt,
    type: buildHotTopicType(index),
    articleId: article.id,
    category: article.category,
    summary: article.summary,
    url: article.url,
    originalLanguage: article.originalLanguage,
    requestedLanguage: safeText(options.language, article.requestedLanguage),
    isFromLiveApi: article.isFromLiveApi,
    ...pickLocalizedArticleFields(article),
  }));
}

export function getPersonalizedArticles(interests, options = {}) {
  const limitPerInterest = Number(options.limitPerInterest) > 0
    ? Number(options.limitPerInterest)
    : 3;
  const selectedInterests = Array.isArray(interests) && interests.length > 0
    ? interests
    : ['world'];

  return selectedInterests.reduce((accumulator, interest) => {
    const normalizedInterest = normalizeCategory(interest);
    accumulator[interest] = getArticlesByCategory(normalizedInterest, { limit: limitPerInterest });
    return accumulator;
  }, {});
}

export default {
  NEWS_CATEGORIES,
  getAllArticles,
  getTrendingArticles,
  getArticlesByCategory,
  getArticleById,
  searchArticles,
  getHotTopics,
  getPersonalizedArticles,
};
