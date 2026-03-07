// Credibility analysis engine for Sure Bo?
// Generates article summaries, signals, and context-aware recommendations.
import { mockAnalysis } from '../data/mockAnalysis';
import { mockArticles } from '../data/mockArticles';
import { getTranslation } from '../i18n';
import {
  localizeCredibilityList,
  localizeCredibilityText,
} from '../utils/localizedCredibilityCopy';
import { getAllArticles, getArticleById, getArticlesByCategory, searchArticles } from './articlesApi';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'into', 'about', 'after', 'before', 'while', 'their',
  'there', 'would', 'could', 'should', 'them', 'they', 'will', 'been', 'being',
  'also', 'said', 'says', 'over', 'under', 'more', 'less', 'than', 'into',
  'across', 'through', 'between', 'where', 'when', 'what', 'your', 'about',
  'because', 'which', 'whose', 'news', 'article', 'report',
]);

const OFFICIAL_RESOURCE_RULES = [
  { name: 'Government of Singapore', url: 'https://www.gov.sg/', keywords: ['singapore', 'sg', 'government', 'policy', 'parliament', 'minister'] },
  { name: 'Ministry of Health Singapore', url: 'https://www.moh.gov.sg/', keywords: ['health', 'hospital', 'medicine', 'moh', 'covid', 'vaccine', 'disease'] },
  { name: 'Health Sciences Authority', url: 'https://www.hsa.gov.sg/', keywords: ['health', 'supplement', 'drug', 'medical', 'hsa'] },
  { name: 'Land Transport Authority', url: 'https://www.lta.gov.sg/', keywords: ['transport', 'mrt', 'rail', 'bus', 'lta'] },
  { name: 'Monetary Authority of Singapore', url: 'https://www.mas.gov.sg/', keywords: ['finance', 'bank', 'investment', 'scam', 'mas', 'market', 'economic'] },
  { name: 'Singapore Police Force', url: 'https://www.police.gov.sg/', keywords: ['scam', 'fraud', 'crime', 'police', 'investigation'] },
  { name: 'National Environment Agency', url: 'https://www.nea.gov.sg/', keywords: ['environment', 'climate', 'pollution', 'air quality', 'nea'] },
  { name: 'PUB Singapore', url: 'https://www.pub.gov.sg/', keywords: ['water', 'supply', 'contamination', 'pub'] },
  { name: 'World Health Organization', url: 'https://www.who.int/', keywords: ['who', 'global health', 'pandemic', 'disease', 'health'] },
  { name: 'United Nations Climate Action', url: 'https://www.un.org/en/climatechange', keywords: ['climate', 'emissions', 'environment', 'sustainability'] },
  { name: 'National University of Singapore', url: 'https://www.nus.edu.sg/', keywords: ['study', 'research', 'university', 'nus'] },
  { name: 'Nanyang Technological University', url: 'https://www.ntu.edu.sg/', keywords: ['study', 'research', 'university', 'ntu'] },
  { name: 'OpenAI Newsroom', url: 'https://openai.com/news/', keywords: ['openai'] },
  { name: 'Google Blog', url: 'https://blog.google/', keywords: ['google'] },
  { name: 'Microsoft News', url: 'https://news.microsoft.com/', keywords: ['microsoft'] },
  { name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com/', keywords: ['nvidia'] },
  { name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/', keywords: ['apple'] },
  { name: 'Meta Newsroom', url: 'https://about.fb.com/news/', keywords: ['meta', 'facebook', 'instagram'] },
  { name: 'Singapore Ministry of Trade and Industry', url: 'https://www.mti.gov.sg/', keywords: ['trade', 'industry', 'economy', 'manufacturing'] },
];

function simulateDelay(ms = 900) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeWhitespace(text) {
  return safeText(text).replace(/\s+/g, ' ').trim();
}

function stripTrailingMarker(text) {
  return normalizeWhitespace(text).replace(/\s*\[\+\d+\s+chars\]\s*$/i, '').trim();
}

function splitIntoSentences(text) {
  return stripTrailingMarker(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 35);
}

function extractKeywords(text, limit = 12) {
  const tokens = normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !STOPWORDS.has(token));

  const frequency = new Map();
  tokens.forEach((token) => {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function truncate(text, maxLength = 190) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function scoreSentence(sentence, index, keywords) {
  const lower = sentence.toLowerCase();
  const keywordHits = keywords.reduce((count, keyword) => (
    lower.includes(keyword) ? count + 1 : count
  ), 0);
  const hasNumber = /\d/.test(sentence);
  const leadBonus = index < 3 ? 2 : 0;
  const factBonus = hasNumber ? 1.5 : 0;
  return keywordHits * 1.4 + leadBonus + factBonus;
}

function buildSummary(article) {
  const fullText = [
    safeText(article?.content),
    safeText(article?.description),
  ].filter(Boolean).join(' ');

  const sentences = splitIntoSentences(fullText);
  const keywords = extractKeywords(`${article?.title || ''} ${fullText}`, 10);

  if (sentences.length === 0) {
    const fallback = safeText(article?.description) || safeText(article?.title);
    if (!fallback) {
      return ['Summary unavailable. The article body does not contain enough text.'];
    }
    return [truncate(fallback)];
  }

  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, index, keywords) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const picked = ranked.slice(0, 4).sort((a, b) => a.index - b.index);
  const summary = picked.map(item => truncate(item.sentence));

  if (summary.length < 2 && sentences[1]) {
    summary.push(truncate(sentences[1]));
  }

  return summary.slice(0, 4);
}

function sourceReputationLevel(sourceName) {
  const source = safeText(sourceName).toLowerCase();
  if (!source) return 'low';
  if (/(reuters|associated press|ap|bloomberg|financial times|bbc|cna|straits times|who|gov)/.test(source)) return 'high';
  if (/(today|mothership|yahoo|insider|times|post)/.test(source)) return 'medium';
  return 'medium';
}

function estimateSignals(article, summary) {
  const title = safeText(article?.title);
  const description = safeText(article?.description);
  const content = safeText(article?.content);
  const body = `${title} ${description} ${content}`.toLowerCase();

  const sensational = /(shocking|secret|viral|must share|guaranteed|cure-all|conspiracy|urgent)/.test(body);
  const evidencePresent = /\d/.test(body) || /(according to|stated|reported|data|study)/.test(body);
  const recency = (() => {
    const published = new Date(article?.publishedAt);
    if (Number.isNaN(published.getTime())) return 'recent';
    const ageHours = (Date.now() - published.getTime()) / 3_600_000;
    return ageHours <= 72 ? 'recent' : 'outdated';
  })();

  const officialSources = summary.some((line) => /(ministry|authority|agency|who|government|official)/i.test(line))
    || /(gov\.sg|moh|mas|nea|pub|who\.int)/.test(body);

  return {
    sourceReputation: sourceReputationLevel(article?.source),
    consistency: evidencePresent ? 'medium' : 'low',
    crossSource: sourceReputationLevel(article?.source) !== 'low',
    evidencePresent,
    headlineTone: sensational ? 'sensational' : 'neutral',
    recency,
    officialSources,
  };
}

function classifyCredibility(signals) {
  const highSource = signals.sourceReputation === 'high';
  const sensational = signals.headlineTone === 'sensational';
  const recent = signals.recency === 'recent';
  const evidence = signals.evidencePresent;

  if (highSource && evidence && recent && !sensational) {
    return { credibility: 'credible', confidence: 82 };
  }

  if (sensational && !evidence) {
    return { credibility: 'notCredible', confidence: 70 };
  }

  if (evidence || highSource) {
    return { credibility: 'mixed', confidence: 63 };
  }

  return { credibility: 'undetermined', confidence: 48 };
}

function buildExplanation(article, credibility, signals) {
  const source = safeText(article?.source, 'Unknown source');
  if (credibility === 'credible') {
    return `This article appears credible because it cites concrete details and comes from a relatively reliable source (${source}).`;
  }
  if (credibility === 'notCredible') {
    return `This article contains sensational framing with weak evidence signals, so credibility is currently low.`;
  }
  if (credibility === 'mixed') {
    return `This article has some supporting details but still has uncertain signals (source=${signals.sourceReputation}, evidence=${signals.evidencePresent ? 'present' : 'limited'}).`;
  }
  return `There is not enough reliable evidence in this article to make a high-confidence credibility judgment yet.`;
}

function buildOfficialResources(article, summary) {
  const searchText = normalizeWhitespace([
    safeText(article?.title),
    safeText(article?.description),
    safeText(article?.content),
    safeText(article?.source),
    safeText(article?.category),
    summary.join(' '),
  ].join(' ')).toLowerCase();

  const scoredResources = OFFICIAL_RESOURCE_RULES
    .map((resource) => {
      const score = resource.keywords.reduce((count, keyword) => (
        searchText.includes(keyword.toLowerCase()) ? count + 1 : count
      ), 0);
      return { ...resource, score };
    })
    .filter(resource => resource.score >= 1)
    .sort((a, b) => b.score - a.score);

  const deduped = [];
  const seenUrls = new Set();
  scoredResources.forEach((resource) => {
    if (seenUrls.has(resource.url)) return;
    seenUrls.add(resource.url);
    deduped.push({ name: resource.name, url: resource.url });
  });

  return deduped.slice(0, 4);
}

function buildRecommendation(credibility, resources) {
  if (credibility === 'credible') {
    return {
      action: 'You can treat this as likely reliable, but still cross-check major claims before sharing.',
      resources,
      relatedArticleIds: [],
    };
  }
  if (credibility === 'notCredible') {
    return {
      action: 'Do not share this yet. Verify the claim directly with official or primary sources first.',
      resources,
      relatedArticleIds: [],
    };
  }
  if (credibility === 'mixed') {
    return {
      action: 'Some elements may be correct, but verify key facts with official references before acting on it.',
      resources,
      relatedArticleIds: [],
    };
  }
  return {
    action: 'There is not enough evidence yet. Wait for corroboration from trusted sources before sharing.',
    resources,
    relatedArticleIds: [],
  };
}

function buildFallbackAnalysis() {
  return {
    credibility: 'undetermined',
    confidence: 40,
    explanation: 'We do not have enough information to assess the credibility of this article at this time.',
    summary: ['Summary unavailable. The article body does not contain enough usable content.'],
    signals: {
      sourceReputation: 'medium',
      consistency: 'low',
      crossSource: false,
      evidencePresent: false,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: false,
    },
    recommendation: {
      action: 'Please verify this information using trusted official sources before sharing.',
      resources: [],
      relatedArticleIds: [],
    },
  };
}

function localizeAnalysisOutput(analysis, language = 'en') {
  const t = (key) => getTranslation(language, key);

  return {
    ...analysis,
    explanation: localizeCredibilityText(analysis?.explanation || '', t),
    summary: Array.isArray(analysis?.summary)
      ? localizeCredibilityList(analysis.summary, t)
      : localizeCredibilityText(analysis?.summary || '', t),
    keyFindings: Array.isArray(analysis?.keyFindings)
      ? localizeCredibilityList(analysis.keyFindings, t)
      : [],
    recommendation: analysis?.recommendation
      ? {
          ...analysis.recommendation,
          action: localizeCredibilityText(analysis.recommendation.action || '', t),
        }
      : analysis?.recommendation,
  };
}

function resolveArticle(articleOrId) {
  if (!articleOrId) return null;
  if (typeof articleOrId === 'object') return articleOrId;
  if (typeof articleOrId === 'string') {
    return getArticleById(articleOrId) || mockArticles.find(article => article.id === articleOrId) || null;
  }
  return null;
}

function normalizeUrl(value) {
  const raw = safeText(value).toLowerCase();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  }
}

function normalizeHeadline(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(text, minimumLength = 3) {
  return new Set(
    normalizeWhitespace(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= minimumLength && !STOPWORDS.has(token))
  );
}

function ngramSet(text, size = 2) {
  const normalized = normalizeHeadline(text);
  if (!normalized) return new Set();
  const compact = normalized.replace(/\s+/g, ' ');
  const grams = new Set();

  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.add(compact.slice(index, index + size));
  }

  return grams;
}

function extractNamedEntities(text) {
  const raw = safeText(text);
  if (!raw) return new Set();

  const matches = raw.match(/\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,}|\d{2,4}|of|for|and))*\b/g) || [];
  return new Set(
    matches
      .map(match => normalizeWhitespace(match))
      .filter(match => match.length >= 3 && !STOPWORDS.has(match.toLowerCase()))
  );
}

function overlapRatio(setA, setB) {
  if (!(setA instanceof Set) || !(setB instanceof Set) || setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  setA.forEach((item) => {
    if (setB.has(item)) overlap += 1;
  });
  return overlap / Math.max(setA.size, setB.size);
}

function bigramSimilarity(textA, textB) {
  const setA = ngramSet(textA, 2);
  const setB = ngramSet(textB, 2);
  if (setA.size === 0 || setB.size === 0) return 0;

  let overlap = 0;
  setA.forEach((gram) => {
    if (setB.has(gram)) overlap += 1;
  });

  return (2 * overlap) / (setA.size + setB.size);
}

function buildArticleProfile(article) {
  const title = safeText(article?.title);
  const summary = safeText(article?.summary || article?.description || article?.content);
  const category = safeText(article?.category).toLowerCase();
  const source = safeText(article?.source).toLowerCase();
  const publishedAt = safeText(article?.publishedAt);
  const identity = normalizeUrl(article?.url || article?.originalUrl) || safeText(article?.id);

  return {
    article,
    identity,
    title,
    summary,
    category,
    source,
    titleTokens: tokenSet(title),
    summaryTokens: tokenSet(summary),
    titleEntities: extractNamedEntities(title),
    summaryEntities: extractNamedEntities(summary),
    titleBigramScore: title,
    summaryBigramScore: summary,
    normalizedHeadline: normalizeHeadline(title),
    publishedAt,
  };
}

function isNearDuplicate(baseProfile, candidateProfile) {
  if (!candidateProfile.identity) return false;
  if (baseProfile.identity && candidateProfile.identity === baseProfile.identity) return true;
  if (baseProfile.article?.id && candidateProfile.article?.id && baseProfile.article.id === candidateProfile.article.id) return true;
  if (baseProfile.normalizedHeadline && baseProfile.normalizedHeadline === candidateProfile.normalizedHeadline) return true;

  const headlineSimilarity = bigramSimilarity(baseProfile.title, candidateProfile.title);
  if (headlineSimilarity >= 0.88 && baseProfile.source && baseProfile.source === candidateProfile.source) {
    return true;
  }

  return false;
}

function scoreRelatedArticle(baseProfile, candidateProfile) {
  const categoryMatch = baseProfile.category && baseProfile.category === candidateProfile.category ? 0.18 : 0;
  const sourceMatch = baseProfile.source && baseProfile.source === candidateProfile.source ? 0.05 : 0;
  const titleTokenOverlap = overlapRatio(baseProfile.titleTokens, candidateProfile.titleTokens);
  const summaryTokenOverlap = overlapRatio(baseProfile.summaryTokens, candidateProfile.summaryTokens);
  const titleEntityOverlap = overlapRatio(baseProfile.titleEntities, candidateProfile.titleEntities);
  const summaryEntityOverlap = overlapRatio(baseProfile.summaryEntities, candidateProfile.summaryEntities);
  const titleSemanticSimilarity = bigramSimilarity(baseProfile.title, candidateProfile.title);
  const summarySemanticSimilarity = bigramSimilarity(baseProfile.summary, candidateProfile.summary);
  const sharedEntityBoost = Math.max(titleEntityOverlap, summaryEntityOverlap);

  const relevance = (
    categoryMatch
    + sourceMatch
    + (titleTokenOverlap * 0.20)
    + (summaryTokenOverlap * 0.18)
    + (titleSemanticSimilarity * 0.18)
    + (summarySemanticSimilarity * 0.12)
    + (sharedEntityBoost * 0.18)
  ) * 100;

  return {
    score: Math.round(relevance),
    titleSemanticSimilarity,
    summarySemanticSimilarity,
    sharedEntityBoost,
    categoryMatch,
  };
}

function buildSearchQuery(article) {
  const titleEntities = Array.from(extractNamedEntities(article?.title)).slice(0, 3);
  const keywords = extractKeywords([
    safeText(article?.title),
    safeText(article?.summary || article?.description),
    safeText(article?.category),
  ].join(' '), 6);

  const queryTerms = [...titleEntities, ...keywords].filter(Boolean);
  return queryTerms.slice(0, 6).join(' ');
}

function dedupeRelatedCandidates(candidates, baseProfile) {
  const deduped = [];
  const seen = new Set();

  candidates.forEach((candidate) => {
    if (!candidate) return;
    const profile = buildArticleProfile(candidate);
    const key = profile.identity || candidate.id || profile.normalizedHeadline;
    if (!key || seen.has(key)) return;
    if (isNearDuplicate(baseProfile, profile)) return;
    seen.add(key);
    deduped.push(candidate);
  });

  return deduped;
}

export async function analyzeArticle(articleOrId, { language = 'en' } = {}) {
  await simulateDelay(450);

  if (typeof articleOrId === 'string' && mockAnalysis[articleOrId]) {
    return localizeAnalysisOutput(mockAnalysis[articleOrId], language);
  }

  const article = resolveArticle(articleOrId);
  if (!article) return localizeAnalysisOutput(buildFallbackAnalysis(), language);

  const summary = buildSummary(article);
  const signals = estimateSignals(article, summary);
  const verdict = classifyCredibility(signals);
  const resources = buildOfficialResources(article, summary);

  return localizeAnalysisOutput({
    credibility: verdict.credibility,
    confidence: verdict.confidence,
    explanation: buildExplanation(article, verdict.credibility, signals),
    summary,
    signals,
    recommendation: buildRecommendation(verdict.credibility, resources),
  }, language);
}

export async function analyzeUserClaim(input) {
  await simulateDelay(900);

  const { text, url, fileName, language = 'en' } = input;
  const query = text || url || fileName || '';

  const matchedArticle = mockArticles.find(a =>
    query.toLowerCase().includes(a.title.toLowerCase().slice(0, 30))
    || a.title.toLowerCase().includes(query.toLowerCase().slice(0, 30))
  );

  if (matchedArticle && mockAnalysis[matchedArticle.id]) {
    const analysis = localizeAnalysisOutput(mockAnalysis[matchedArticle.id], language);
    return {
      ...analysis,
      matchedArticle,
      detectedLanguage: detectLanguage(query),
      originalClaim: query,
    };
  }

  const detectedLang = detectLanguage(query);
  const analysis = localizeAnalysisOutput(generateClaimAnalysis(query), language);

  return {
    ...analysis,
    detectedLanguage: detectedLang,
    originalClaim: query,
  };
}

function detectLanguage(text) {
  if (!text) return 'en';

  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';

  const malayKeywords = ['dan', 'yang', 'untuk', 'dalam', 'dengan', 'tidak', 'adalah', 'ini', 'itu'];
  const words = text.toLowerCase().split(/\s+/);
  const malayCount = words.filter(word => malayKeywords.includes(word)).length;
  if (malayCount >= 2) return 'ms';

  return 'en';
}

function generateClaimAnalysis(claim) {
  const isUrl = claim.startsWith('http') || claim.includes('.com') || claim.includes('.sg');
  const isLong = claim.length > 100;
  const containsSensationalWords = /breaking|urgent|shocking|secret|must see|share now|forwarded/i.test(claim);
  const containsOfficialRef = /gov\.sg|moh|mas|cpf|hdb|lta|nea|pub|pofma/i.test(claim);

  let credibility = 'undetermined';
  let confidence = 45;
  let explanation = '';

  if (containsSensationalWords) {
    credibility = 'mixed';
    confidence = 55;
    explanation = 'This claim uses sensational language often associated with misleading content. Verify it with official sources before sharing.';
  } else if (containsOfficialRef) {
    credibility = 'mixed';
    confidence = 60;
    explanation = 'This claim references official institutions but the specific details are not fully verified yet.';
  } else if (isUrl) {
    credibility = 'undetermined';
    confidence = 40;
    explanation = 'The provided URL could not be fully verified. Cross-check this claim with trusted outlets before sharing.';
  } else {
    credibility = 'undetermined';
    confidence = 35;
    explanation = 'There is insufficient evidence to verify this claim at the moment.';
  }

  return {
    credibility,
    confidence,
    explanation,
    summary: [
      `Claim reviewed: "${claim.slice(0, 80)}${claim.length > 80 ? '...' : ''}"`,
      'Assessment is based on available linguistic and context signals.',
      credibility === 'undetermined'
        ? 'Current evidence is insufficient for a definitive conclusion.'
        : `Current signals support a ${credibility} assessment.`,
    ],
    signals: {
      sourceReputation: containsOfficialRef ? 'medium' : 'low',
      consistency: 'low',
      crossSource: false,
      evidencePresent: isLong,
      headlineTone: containsSensationalWords ? 'sensational' : 'neutral',
      recency: 'recent',
      officialSources: containsOfficialRef,
    },
    recommendation: {
      action: credibility === 'undetermined'
        ? 'Do not share this yet. Verify with official agencies and trusted media first.'
        : 'Proceed with caution and confirm the claim with official references.',
      resources: [
        { name: 'Gov.sg Factually', url: 'https://www.gov.sg/factually' },
        { name: 'ScamShield', url: 'https://www.scamshield.org.sg/' },
      ],
      relatedArticleIds: [],
    },
  };
}

export async function getRelatedArticles(articleOrId) {
  await simulateDelay(300);

  if (typeof articleOrId === 'string' && mockAnalysis[articleOrId]) {
    const relatedIds = mockAnalysis[articleOrId]?.recommendation?.relatedArticleIds || [];
    return mockArticles.filter(article => relatedIds.includes(article.id));
  }

  const article = resolveArticle(articleOrId);
  if (!article) return [];
  const baseProfile = buildArticleProfile(article);
  const searchQuery = buildSearchQuery(article);
  const categoryCandidates = getArticlesByCategory(article.category, { limit: 12 });
  const queryCandidates = searchQuery ? searchArticles(searchQuery, { limit: 12 }) : [];
  const broadCandidates = getAllArticles().slice(0, 24);

  const candidates = dedupeRelatedCandidates([
    ...categoryCandidates,
    ...queryCandidates,
    ...broadCandidates,
  ], baseProfile);

  const ranked = candidates
    .map((candidate) => ({
      article: candidate,
      ...scoreRelatedArticle(baseProfile, buildArticleProfile(candidate)),
    }))
    .filter(item => (
      item.score >= 30
      && (
        item.categoryMatch > 0
        || item.sharedEntityBoost >= 0.15
        || item.titleSemanticSimilarity >= 0.20
        || item.summarySemanticSimilarity >= 0.15
      )
    ))
    .sort((a, b) => (
      b.score - a.score
      || new Date(b.article.publishedAt) - new Date(a.article.publishedAt)
    ));

  return ranked.slice(0, 4).map(item => item.article);
}

export default {
  analyzeArticle,
  analyzeUserClaim,
  getRelatedArticles,
};
