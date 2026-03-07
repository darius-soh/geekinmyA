/* global process */
import { createHash } from 'node:crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import {
  buildArticleComparisonText,
  buildSourceProfileText,
  getCredibleSourceByDomain,
  loadCredibleSources,
  normalizeDomain,
} from './credibleSources.js';

const DEFAULT_CREDIBLE_SOURCES_NAMESPACE = 'credible-sources';
const DEFAULT_TOP_K = 5;
const DEFAULT_INTEGRATED_EMBEDDING_MODEL = 'multilingual-e5-large';
const DEFAULT_TEXT_FIELD = 'text';
const SIMILARITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LOW_SUPPORT_SOURCE_TYPES = new Set([
  'satire',
  'social-platform',
  'community-platform',
  'user-generated-platform',
]);

// Pinecone integrated search returns model-specific similarity scores instead of
// the locally computed cosine values we used in the OpenAI embedding flow.
// These cutoffs keep the downstream credibility weighting in roughly the same bands.
const RAW_SEMANTIC_SCORE_WEAK = 0.05;
const RAW_SEMANTIC_SCORE_MEDIUM = 0.08;
const RAW_SEMANTIC_SCORE_STRONG = 0.12;

const pineconeClientCache = new Map();
const indexDescriptorCache = new Map();
const namespaceRecordCountCache = new Map();
const similarityCache = new Map();

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function hashText(value) {
  return createHash('sha1').update(safeText(value)).digest('hex').slice(0, 16);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function normalizeHost(value) {
  const raw = safeText(value);
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

function normalizeSourceName(value) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCategory(value) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeLanguage(value) {
  return safeText(value).toLowerCase();
}

function normalizeCredibilityTier(value) {
  return safeText(value).toLowerCase();
}

function normalizeSourceType(value) {
  return safeText(value).toLowerCase();
}

function tierSupportFactor(value) {
  switch (normalizeCredibilityTier(value)) {
    case 'very-high':
      return 1;
    case 'high':
      return 0.85;
    case 'medium-high':
      return 0.7;
    case 'medium':
      return 0.45;
    case 'low':
      return 0.08;
    case 'very-low':
      return 0.02;
    default:
      return 0.4;
  }
}

function sourceTypeSupportCap(value) {
  switch (normalizeSourceType(value)) {
    case 'satire':
      return 0.02;
    case 'social-platform':
    case 'user-generated-platform':
      return 0.05;
    case 'community-platform':
      return 0.08;
    default:
      return 1;
  }
}

function supportFactorForSource(sourceLike) {
  if (!sourceLike) return 0;
  return clamp(
    Math.min(
      tierSupportFactor(sourceLike.credibilityTier),
      sourceTypeSupportCap(sourceLike.sourceType)
    ),
    0,
    1
  );
}

function exactDomainBoostForSource(sourceLike) {
  if (!sourceLike) return 0;

  switch (normalizeSourceType(sourceLike.sourceType)) {
    case 'satire':
      return 0.06;
    case 'social-platform':
    case 'user-generated-platform':
      return 0.12;
    case 'community-platform':
      return 0.18;
    default:
      break;
  }

  switch (normalizeCredibilityTier(sourceLike.credibilityTier)) {
    case 'very-high':
      return 0.94;
    case 'high':
      return 0.88;
    case 'medium-high':
      return 0.82;
    case 'medium':
      return 0.72;
    case 'low':
      return 0.22;
    case 'very-low':
      return 0.08;
    default:
      return 0.58;
  }
}

function isLowSupportSource(sourceLike) {
  if (!sourceLike) return false;
  return LOW_SUPPORT_SOURCE_TYPES.has(normalizeSourceType(sourceLike.sourceType))
    || supportFactorForSource(sourceLike) <= 0.1;
}

function capTotalScoreForExactSource(score, exactSource) {
  if (!exactSource) return score;

  switch (normalizeSourceType(exactSource.sourceType)) {
    case 'satire':
      return Math.min(score, 0.18);
    case 'social-platform':
    case 'user-generated-platform':
      return Math.min(score, 0.22);
    case 'community-platform':
      return Math.min(score, 0.28);
    default:
      break;
  }

  switch (normalizeCredibilityTier(exactSource.credibilityTier)) {
    case 'very-low':
      return Math.min(score, 0.18);
    case 'low':
      return Math.min(score, 0.28);
    default:
      return score;
  }
}

function normalizeIntegratedSemanticScore(rawScore) {
  const score = clamp(Number(rawScore) || 0, 0, 1);

  if (score >= RAW_SEMANTIC_SCORE_STRONG) {
    const bandProgress = (score - RAW_SEMANTIC_SCORE_STRONG) / Math.max(1 - RAW_SEMANTIC_SCORE_STRONG, 0.0001);
    return clamp(0.85 + (bandProgress * 0.15), 0.85, 1);
  }

  if (score >= RAW_SEMANTIC_SCORE_MEDIUM) {
    const bandProgress = (score - RAW_SEMANTIC_SCORE_MEDIUM) / (RAW_SEMANTIC_SCORE_STRONG - RAW_SEMANTIC_SCORE_MEDIUM);
    return clamp(0.78 + (bandProgress * 0.07), 0.78, 0.85);
  }

  if (score >= RAW_SEMANTIC_SCORE_WEAK) {
    const bandProgress = (score - RAW_SEMANTIC_SCORE_WEAK) / (RAW_SEMANTIC_SCORE_MEDIUM - RAW_SEMANTIC_SCORE_WEAK);
    return clamp(0.70 + (bandProgress * 0.08), 0.70, 0.78);
  }

  return score > 0
    ? clamp((score / RAW_SEMANTIC_SCORE_WEAK) * 0.69, 0, 0.69)
    : 0;
}

function semanticBoostForScore(score) {
  if (score >= 0.85) return 0.30;
  if (score >= 0.78) return 0.20;
  if (score >= 0.70) return 0.10;
  return 0;
}

function signalForTotalScore(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.50) return 'medium';
  if (score > 0) return 'low';
  return 'unknown';
}

function metadataAlignmentBoost(article, source) {
  if (!source) return 0;

  let boost = 0;
  const articleLanguage = normalizeLanguage(article?.requestedLanguage || article?.language);
  const sourceLanguage = normalizeLanguage(source?.language);
  const articleCategory = normalizeCategory(article?.category || article?.topic);
  const sourceCategory = normalizeCategory(source?.category);
  const sourceTags = Array.isArray(source?.tags)
    ? source.tags.map(tag => normalizeCategory(tag)).filter(Boolean)
    : [];
  const articleSourceName = normalizeSourceName(article?.source || article?.sourceName);
  const sourceName = normalizeSourceName(source?.sourceName);

  if (articleLanguage && sourceLanguage && (sourceLanguage === 'multilingual' || articleLanguage === sourceLanguage)) {
    boost += 0.05;
  }

  if (articleCategory && (articleCategory === sourceCategory || sourceTags.includes(articleCategory))) {
    boost += 0.05;
  }

  if (articleSourceName && sourceName && articleSourceName === sourceName) {
    boost += 0.05;
  }

  return clamp(boost * supportFactorForSource(source), 0, 0.15);
}

function describeSourceClassification(source) {
  const sourceType = normalizeSourceType(source?.sourceType);

  switch (sourceType) {
    case 'satire':
      return 'a satire publication';
    case 'social-platform':
    case 'user-generated-platform':
      return 'a social platform';
    case 'community-platform':
      return 'a user-generated community platform';
    default:
      break;
  }

  const tier = normalizeCredibilityTier(source?.credibilityTier);
  if (tier === 'low' || tier === 'very-low') {
    return 'a low-credibility source profile';
  }

  return 'a source-registry profile';
}

function appendExactSourceContext(explanation, exactSource) {
  if (!exactSource) return explanation;

  const exactDomain = safeText(exactSource.domain);

  if (isLowSupportSource(exactSource)) {
    return `${explanation} The matched domain (${exactDomain}) is classified as ${describeSourceClassification(exactSource)}, so it should not be treated as strong credibility support.`;
  }

  return `${explanation} The matched domain (${exactDomain}) is listed in the source registry with a ${safeText(exactSource.credibilityTier, 'medium')} credibility tier.`;
}

function buildSimilarityExplanation({
  exactSource,
  semanticMatches,
  credibilitySignal,
  namespaceReady,
}) {
  const topMatchNames = semanticMatches.slice(0, 2).map(match => match.sourceName).filter(Boolean);
  const topMatchSummary = topMatchNames.length ? topMatchNames.join(', ') : 'vetted source profiles';
  const topSemanticMatch = semanticMatches[0] || null;

  if (exactSource && isLowSupportSource(exactSource)) {
    return `This article comes from a source-registry domain (${exactSource.domain}) that is classified as ${describeSourceClassification(exactSource)}. That does not provide meaningful credibility support for news verification, even if some wording overlaps with stronger sources.`;
  }

  if (exactSource && namespaceReady && semanticMatches.length > 0) {
    return `This article comes from a source-registry domain (${exactSource.domain}) and is also semantically similar to curated source profiles such as ${topMatchSummary}. That adds source-reputation support, but it is only one credibility factor and not a full fact-check.`;
  }

  if (exactSource) {
    return `This article comes from a source-registry domain (${exactSource.domain}) listed in the source database. That supports source reputation, but it does not by itself verify every claim or framing choice in the article.`;
  }

  if (topSemanticMatch && isLowSupportSource(topSemanticMatch)) {
    return `This article is most similar to source profiles such as ${topMatchSummary} that are classified as ${describeSourceClassification(topSemanticMatch)}. That does not add meaningful credibility support and should be treated cautiously.`;
  }

  if (semanticMatches.length > 0 && credibilitySignal !== 'unknown') {
    return `This article is semantically similar to source-registry profiles such as ${topMatchSummary}. That suggests some alignment with established editorial or public-interest sources, but similarity alone does not confirm that the article is fully accurate or complete.`;
  }

  if (!namespaceReady) {
    return 'The source registry is available for exact domain matching, but the Pinecone similarity index is not ready yet. This signal currently provides limited support and should not be treated as a fact-check.';
  }

  return 'No strong source-registry similarity was found for this article. That does not prove the article is unreliable, but it provides little additional source-reputation support.';
}

function buildUnknownResult(explanation, exactSource = null) {
  const metadataBoost = metadataAlignmentBoost({}, exactSource);
  const exactDomainBoost = exactDomainBoostForSource(exactSource);
  const totalScore = capTotalScoreForExactSource(
    clamp(exactDomainBoost + metadataBoost, 0, 1),
    exactSource
  );

  return {
    status: 'ready',
    credibilitySignal: signalForTotalScore(totalScore),
    similarityScore: Math.round(totalScore * 100),
    exactDomainMatch: Boolean(exactSource),
    topMatches: [],
    explanation: appendExactSourceContext(explanation, exactSource),
    note: 'This is a trust signal, not a definitive truth judgment.',
    scoringBreakdown: {
      exactDomainBoost: Math.round(exactDomainBoost * 100),
      semanticBoost: 0,
      metadataBoost: Math.round(metadataBoost * 100),
      totalScore: Math.round(totalScore * 100),
    },
  };
}

function resolveSimilarityConfig(options = {}) {
  return {
    pineconeApiKey: safeText(options.pineconeApiKey || process.env.PINECONE_API_KEY),
    pineconeIndexHost: normalizeHost(options.pineconeIndexHost || process.env.PINECONE_INDEX_HOST),
    pineconeIndexName: safeText(options.pineconeIndexName || process.env.PINECONE_INDEX_NAME),
    pineconeNamespace: safeText(
      options.pineconeNamespace
      || process.env.PINECONE_CREDIBLE_SOURCES_NAMESPACE,
      DEFAULT_CREDIBLE_SOURCES_NAMESPACE
    ),
    pineconeTextField: safeText(
      options.pineconeTextField
      || process.env.PINECONE_TEXT_FIELD,
      DEFAULT_TEXT_FIELD
    ),
    integratedEmbeddingModel: safeText(
      options.integratedEmbeddingModel
      || process.env.PINECONE_INTEGRATED_EMBEDDING_MODEL,
      DEFAULT_INTEGRATED_EMBEDDING_MODEL
    ),
    topK: Number(options.topK) > 0 ? Number(options.topK) : DEFAULT_TOP_K,
  };
}

function getPineconeClient(config) {
  const cacheKey = hashText(config.pineconeApiKey);
  if (pineconeClientCache.has(cacheKey)) {
    return pineconeClientCache.get(cacheKey);
  }

  const client = new Pinecone({ apiKey: config.pineconeApiKey });
  pineconeClientCache.set(cacheKey, client);
  return client;
}

async function resolveIndexDescriptor(config) {
  const cacheKey = JSON.stringify({
    host: config.pineconeIndexHost,
    name: config.pineconeIndexName,
  });
  const cached = readTimedCache(indexDescriptorCache, cacheKey, SIMILARITY_CACHE_TTL_MS);
  if (cached) return cached;

  if (!config.pineconeApiKey || (!config.pineconeIndexHost && !config.pineconeIndexName)) {
    return null;
  }

  const client = getPineconeClient(config);

  try {
    let descriptor = null;

    if (config.pineconeIndexName) {
      descriptor = await client.describeIndex(config.pineconeIndexName);
    } else if (config.pineconeIndexHost) {
      const normalizedHost = normalizeHost(config.pineconeIndexHost).replace(/^https?:\/\//, '');
      const indexes = await client.listIndexes();
      descriptor = (indexes?.indexes || []).find(indexModel => (
        normalizeHost(indexModel?.host).replace(/^https?:\/\//, '') === normalizedHost
      )) || null;
    }

    writeTimedCache(indexDescriptorCache, cacheKey, descriptor);
    return descriptor;
  } catch {
    return null;
  }
}

function getPineconeIndex(config) {
  if (!config.pineconeApiKey) {
    throw new Error('PINECONE_API_KEY is not configured.');
  }

  if (!config.pineconeIndexHost && !config.pineconeIndexName) {
    throw new Error('PINECONE_INDEX_HOST or PINECONE_INDEX_NAME is required.');
  }

  const client = getPineconeClient(config);

  if (config.pineconeIndexHost) {
    return client.index({
      host: config.pineconeIndexHost,
      namespace: config.pineconeNamespace,
    });
  }

  return client.index({
    name: config.pineconeIndexName,
    namespace: config.pineconeNamespace,
  });
}

async function getNamespaceRecordCount(config) {
  const cacheKey = `${config.pineconeIndexHost || config.pineconeIndexName}|${config.pineconeNamespace}`;
  const cached = readTimedCache(namespaceRecordCountCache, cacheKey, 5 * 60 * 1000);
  if (cached !== null) return cached;

  try {
    const index = getPineconeIndex(config);
    const description = await index.describeNamespace(config.pineconeNamespace);
    const recordCount = Number(description?.recordCount) || 0;
    writeTimedCache(namespaceRecordCountCache, cacheKey, recordCount);
    return recordCount;
  } catch {
    writeTimedCache(namespaceRecordCountCache, cacheKey, 0);
    return 0;
  }
}

function buildSimilarityCacheKey(article, comparisonText, config) {
  const normalizedUrl = safeText(article?.canonicalUrl || article?.url || article?.originalUrl);
  const articleTextHash = hashText(comparisonText);
  return JSON.stringify({
    namespace: config.pineconeNamespace,
    url: normalizedUrl,
    articleTextHash,
  });
}

function extractTextFieldFromFieldMap(fieldMap) {
  if (!fieldMap || typeof fieldMap !== 'object') return '';

  if (typeof fieldMap.text === 'string' && fieldMap.text.trim()) {
    return fieldMap.text.trim();
  }

  const firstMappedField = Object.values(fieldMap).find(value => typeof value === 'string' && value.trim());
  return typeof firstMappedField === 'string' ? firstMappedField.trim() : '';
}

function resolveIntegratedIndexSettings(config, descriptor) {
  const embed = descriptor?.embed && typeof descriptor.embed === 'object'
    ? descriptor.embed
    : null;
  const fieldMap = embed?.fieldMap && typeof embed.fieldMap === 'object'
    ? embed.fieldMap
    : null;

  return {
    isIntegrated: descriptor ? Boolean(embed && fieldMap) : true,
    textField: extractTextFieldFromFieldMap(fieldMap) || config.pineconeTextField,
    embeddingModel: safeText(embed?.model, config.integratedEmbeddingModel),
    metric: safeText(descriptor?.metric),
    vectorType: safeText(descriptor?.vectorType),
    readParameters: embed?.readParameters && typeof embed.readParameters === 'object'
      ? embed.readParameters
      : null,
    writeParameters: embed?.writeParameters && typeof embed.writeParameters === 'object'
      ? embed.writeParameters
      : null,
  };
}

function buildRequestedSearchFields(textField) {
  return Array.from(new Set([
    safeText(textField, DEFAULT_TEXT_FIELD),
    'sourceName',
    'domain',
    'country',
    'language',
    'category',
    'sourceType',
    'credibilityTier',
    'tags',
  ].filter(Boolean)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === 'string' && item.trim());
}

function normalizeSemanticMatches(queryResponse) {
  const hits = Array.isArray(queryResponse?.result?.hits) ? queryResponse.result.hits : [];

  return hits
    .map((hit) => {
      const fields = hit?.fields && typeof hit.fields === 'object' ? hit.fields : {};
      const rawScore = clamp(Number(hit?._score) || 0, 0, 1);
      const semanticScore = normalizeIntegratedSemanticScore(rawScore);

      return {
        id: safeText(hit?._id || hit?.id),
        sourceName: safeText(fields?.sourceName),
        domain: normalizeDomain(fields?.domain),
        score: Math.round(semanticScore * 100),
        rawScore,
        semanticScore,
        sourceType: safeText(fields?.sourceType),
        credibilityTier: safeText(fields?.credibilityTier),
        country: safeText(fields?.country),
        language: safeText(fields?.language),
        category: safeText(fields?.category),
        tags: normalizeStringArray(fields?.tags),
      };
    })
    .filter(match => match.id && match.sourceName && match.domain)
    .sort((matchA, matchB) => matchB.semanticScore - matchA.semanticScore);
}

export async function evaluateCredibleSourceSimilarity(articleLike, options = {}) {
  const config = resolveSimilarityConfig(options);
  const comparisonText = buildArticleComparisonText(articleLike);
  const exactDomain = normalizeDomain(
    articleLike?.domain
    || articleLike?.sourceUrl
    || articleLike?.canonicalUrl
    || articleLike?.url
    || articleLike?.originalUrl
  );
  const exactSource = exactDomain ? await getCredibleSourceByDomain(exactDomain) : null;

  if (!comparisonText) {
    return buildUnknownResult(
      'There was not enough article text to compare against the vetted source database.',
      exactSource
    );
  }

  const cacheKey = buildSimilarityCacheKey(articleLike, comparisonText, config);
  const cached = readTimedCache(similarityCache, cacheKey, SIMILARITY_CACHE_TTL_MS);
  if (cached) return cached;

  let namespaceReady = false;
  let semanticMatches = [];

  try {
    if (config.pineconeApiKey && (config.pineconeIndexHost || config.pineconeIndexName)) {
      const descriptor = await resolveIndexDescriptor(config);
      const integratedIndex = resolveIntegratedIndexSettings(config, descriptor);

      if (!integratedIndex.isIntegrated) {
        const fallback = buildUnknownResult(
          'The configured Pinecone index is not set up for integrated embeddings. Exact vetted-domain checks still apply, but semantic matching is disabled.',
          exactSource
        );
        writeTimedCache(similarityCache, cacheKey, fallback);
        return fallback;
      }

      const recordCount = await getNamespaceRecordCount(config);
      namespaceReady = recordCount > 0;

      if (namespaceReady) {
        const index = getPineconeIndex(config);
        const queryResponse = await index.searchRecords({
          query: {
            topK: config.topK,
            inputs: { text: comparisonText },
          },
          fields: buildRequestedSearchFields(integratedIndex.textField),
          namespace: config.pineconeNamespace,
        });
        semanticMatches = normalizeSemanticMatches(queryResponse);
      }
    }
  } catch (error) {
    const exactMatchFallback = buildUnknownResult(
      `Credible source similarity search was unavailable (${safeText(error?.message, 'service error')}). Exact vetted-domain checks still apply, but semantic matching could not be completed.`,
      exactSource
    );
    writeTimedCache(similarityCache, cacheKey, exactMatchFallback);
    return exactMatchFallback;
  }

  const topSemanticMatch = semanticMatches[0] || null;
  const semanticScore = topSemanticMatch?.semanticScore || 0;
  const metadataTarget = exactSource || topSemanticMatch || null;

  const exactDomainBoost = exactDomainBoostForSource(exactSource);
  const semanticBoost = semanticBoostForScore(semanticScore) * (topSemanticMatch ? supportFactorForSource(topSemanticMatch) : 1);
  const metadataBoost = metadataAlignmentBoost(articleLike, metadataTarget);
  const totalScore = capTotalScoreForExactSource(
    clamp(exactDomainBoost + semanticBoost + metadataBoost, 0, 1),
    exactSource
  );
  const credibilitySignal = signalForTotalScore(totalScore);

  const result = {
    status: 'ready',
    credibilitySignal,
    similarityScore: Math.round(totalScore * 100),
    exactDomainMatch: Boolean(exactSource),
    topMatches: semanticMatches.slice(0, 3).map(match => ({
      sourceName: match.sourceName,
      domain: match.domain,
      score: match.score,
      sourceType: match.sourceType,
      credibilityTier: match.credibilityTier,
    })),
    explanation: buildSimilarityExplanation({
      exactSource,
      semanticMatches,
      credibilitySignal,
      namespaceReady,
    }),
    note: 'This is a trust signal, not a definitive truth judgment.',
    scoringBreakdown: {
      exactDomainBoost: Math.round(exactDomainBoost * 100),
      semanticBoost: Math.round(semanticBoost * 100),
      metadataBoost: Math.round(metadataBoost * 100),
      totalScore: Math.round(totalScore * 100),
    },
    matchedDomain: exactSource?.domain || '',
  };

  writeTimedCache(similarityCache, cacheKey, result);
  return result;
}

function buildSourceRecord(source, profileText, textField) {
  return {
    id: source.id,
    [textField]: profileText,
    sourceName: safeText(source.sourceName),
    domain: normalizeDomain(source.domain),
    country: safeText(source.country),
    language: safeText(source.language),
    category: safeText(source.category),
    sourceType: safeText(source.sourceType),
    credibilityTier: safeText(source.credibilityTier),
    description: safeText(source.description),
    editorialNotes: safeText(source.editorialNotes),
    tags: Array.isArray(source.tags) ? source.tags : [],
    exampleHeadlines: Array.isArray(source.exampleHeadlines) ? source.exampleHeadlines : [],
    lastReviewedAt: safeText(source.lastReviewedAt),
    profileTextHash: hashText(profileText),
  };
}

function dedupeSources(sources) {
  const seenIds = new Set();
  const seenDomains = new Set();
  const deduped = [];

  sources.forEach((source) => {
    const sourceId = safeText(source?.id);
    const domain = normalizeDomain(source?.domain);
    if (!sourceId || !domain) return;
    if (seenIds.has(sourceId) || seenDomains.has(domain)) return;
    seenIds.add(sourceId);
    seenDomains.add(domain);
    deduped.push(source);
  });

  return deduped;
}

async function fetchExistingIds(index, ids, namespace) {
  const existingIds = new Set();

  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    if (batch.length === 0) continue;

    const response = await index.fetch({
      ids: batch,
      namespace,
    });

    Object.keys(response?.records || {}).forEach(id => existingIds.add(id));
  }

  return existingIds;
}

export async function seedCredibleSources(options = {}) {
  const config = resolveSimilarityConfig(options);
  const sources = dedupeSources(await loadCredibleSources());
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const descriptor = await resolveIndexDescriptor(config);
  const integratedIndex = resolveIntegratedIndexSettings(config, descriptor);

  if (dryRun) {
    return {
      namespace: config.pineconeNamespace,
      totalSources: sources.length,
      uniqueSources: sources.length,
      skippedExisting: 0,
      upserted: 0,
      failed: 0,
      errors: [],
      embeddingModel: integratedIndex.embeddingModel,
      textField: integratedIndex.textField,
      metric: integratedIndex.metric || 'cosine',
      vectorType: integratedIndex.vectorType || 'dense',
    };
  }

  if (!config.pineconeApiKey || (!config.pineconeIndexHost && !config.pineconeIndexName)) {
    throw new Error('Pinecone configuration is incomplete. Set PINECONE_API_KEY and PINECONE_INDEX_HOST (or PINECONE_INDEX_NAME).');
  }

  if (descriptor && !integratedIndex.isIntegrated) {
    throw new Error('The configured Pinecone index is not configured for integrated embeddings. Use an index created with model-based embedding.');
  }

  const index = getPineconeIndex(config);
  const sourceIds = sources.map(source => source.id);
  const existingIds = force
    ? new Set()
    : await fetchExistingIds(index, sourceIds, config.pineconeNamespace);

  const sourcesToUpsert = force
    ? sources
    : sources.filter(source => !existingIds.has(source.id));

  let upserted = 0;
  let failed = 0;
  const errors = [];

  for (let start = 0; start < sourcesToUpsert.length; start += 20) {
    const batch = sourcesToUpsert.slice(start, start + 20);
    if (batch.length === 0) continue;

    try {
      const records = batch.map((source) => {
        const profileText = buildSourceProfileText(source);
        return buildSourceRecord(source, profileText, integratedIndex.textField);
      });

      await index.upsertRecords({
        records,
        namespace: config.pineconeNamespace,
      });

      upserted += records.length;
    } catch (error) {
      failed += batch.length;
      errors.push({
        batchStart: start,
        message: safeText(error?.message, 'Unknown seeding error.'),
      });
    }
  }

  namespaceRecordCountCache.delete(`${config.pineconeIndexHost || config.pineconeIndexName}|${config.pineconeNamespace}`);

  return {
    namespace: config.pineconeNamespace,
    totalSources: sources.length,
    uniqueSources: sources.length,
    skippedExisting: existingIds.size,
    upserted,
    failed,
    errors,
    embeddingModel: integratedIndex.embeddingModel,
    textField: integratedIndex.textField,
    metric: integratedIndex.metric || 'cosine',
    vectorType: integratedIndex.vectorType || 'dense',
  };
}
