import { deriveCredibilityAssessment } from './credibilityModel.js';

const DEFAULT_SIGNALS = {
  sourceAuthority: 50,
  corroboration: 40,
  evidenceQuality: 45,
  recency: 50,
  sensationalismRisk: 50,
};

const LOW_SUPPORT_SOURCE_TYPES = new Set([
  'satire',
  'social-platform',
  'community-platform',
  'user-generated-platform',
]);

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function ensureStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => normalizeWhitespace(item)).filter(Boolean);
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

export function buildDomainCandidates(value) {
  const normalizedDomain = normalizeDomain(value);
  if (!normalizedDomain) return [];

  const domainParts = normalizedDomain.split('.').filter(Boolean);
  const candidates = [];

  for (let index = 0; index < domainParts.length - 1; index += 1) {
    const candidate = domainParts.slice(index).join('.');
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function normalizeCredibilityTier(value) {
  return safeText(value).toLowerCase();
}

export function normalizeSourceType(value) {
  return safeText(value).toLowerCase();
}

export function normalizeSourceRegistryRecord(rawSource = {}) {
  const domain = normalizeDomain(rawSource.domain);

  return {
    id: safeText(rawSource.id, domain || 'unknown-source'),
    sourceName: normalizeWhitespace(rawSource.sourceName),
    domain,
    country: normalizeWhitespace(rawSource.country),
    language: normalizeWhitespace(rawSource.language, 'multilingual'),
    category: normalizeWhitespace(rawSource.category),
    sourceType: normalizeWhitespace(rawSource.sourceType),
    credibilityTier: normalizeWhitespace(rawSource.credibilityTier, 'medium'),
    description: normalizeWhitespace(rawSource.description),
    editorialNotes: normalizeWhitespace(rawSource.editorialNotes),
    tags: ensureStringArray(rawSource.tags),
    exampleHeadlines: ensureStringArray(rawSource.exampleHeadlines),
    lastReviewedAt: normalizeWhitespace(rawSource.lastReviewedAt),
  };
}

export function buildSourceRegistryIndex(rawSources = []) {
  const sources = Array.isArray(rawSources)
    ? rawSources.map(normalizeSourceRegistryRecord).filter(source => source.id && source.domain)
    : [];

  const domainMap = new Map();
  sources.forEach((source) => {
    if (!domainMap.has(source.domain)) {
      domainMap.set(source.domain, source);
    }
  });

  return {
    sources,
    domainMap,
  };
}

function resolveRegistry(sourceRegistry) {
  if (sourceRegistry?.domainMap instanceof Map && Array.isArray(sourceRegistry?.sources)) {
    return sourceRegistry;
  }

  return buildSourceRegistryIndex(sourceRegistry);
}

export function findSourceMatchByDomain(domainOrUrl, sourceRegistry) {
  const registry = resolveRegistry(sourceRegistry);
  const candidates = buildDomainCandidates(domainOrUrl);

  for (const candidate of candidates) {
    const matchedSource = registry.domainMap.get(candidate);
    if (matchedSource) return matchedSource;
  }

  return null;
}

export function findSourceMatchForArticle(article, sourceRegistry) {
  const candidates = [
    article?.sourceUrl,
    article?.domain,
    article?.canonicalUrl,
    article?.url,
    article?.originalUrl,
  ];

  for (const candidate of candidates) {
    const match = findSourceMatchByDomain(candidate, sourceRegistry);
    if (match) return match;
  }

  return null;
}

function sourceClassification(source) {
  if (!source) return 'unknown';

  const sourceType = normalizeSourceType(source.sourceType);
  const tier = normalizeCredibilityTier(source.credibilityTier);

  if (LOW_SUPPORT_SOURCE_TYPES.has(sourceType) || tier === 'low' || tier === 'very-low') {
    return 'low';
  }

  if (tier === 'very-high' || tier === 'high') {
    return 'high';
  }

  if (tier === 'medium-high' || tier === 'medium') {
    return 'borderline';
  }

  return 'unknown';
}

function sourceLabel(source) {
  return safeText(source?.sourceName, 'This source');
}

function sourceDomainLabel(source) {
  return safeText(source?.domain);
}

function sourceSupportProfile(source, classification) {
  const sourceType = normalizeSourceType(source?.sourceType);
  const tier = normalizeCredibilityTier(source?.credibilityTier);

  if (classification === 'high') {
    return {
      credibilityScore: tier === 'very-high' ? 88 : 82,
      confidenceScore: tier === 'very-high' ? 78 : 72,
      signalStrength: tier === 'very-high' ? 88 : 80,
      similarityScore: tier === 'very-high' ? 90 : 82,
      signals: {
        sourceAuthority: tier === 'very-high' ? 94 : 86,
        corroboration: 60,
        evidenceQuality: 62,
        recency: 55,
        sensationalismRisk: 28,
      },
      explanation: `${sourceLabel(source)} is listed in the source registry as a ${tier || 'high'}-credibility source. That provides strong source-reputation support for this article, but it is not a full fact-check of the article's claims.`,
      findings: [
        `${sourceLabel(source)} matches a known source-registry domain.`,
        `The registry classifies ${sourceLabel(source)} as ${tier || 'high'} credibility.`,
        'This is a strong source-based trust signal, not proof that every claim is accurate.',
      ],
      limitations: [
        'This immediate score is primarily based on source classification.',
        'Source reputation alone does not verify every claim or framing choice.',
      ],
      nextStep: 'Read the article and cited primary sources for claim-level verification.',
      credibilitySignal: 'high',
      needsRefinement: false,
    };
  }

  if (classification === 'borderline') {
    return {
      credibilityScore: 62,
      confidenceScore: 54,
      signalStrength: 58,
      similarityScore: 58,
      signals: {
        sourceAuthority: 64,
        corroboration: 46,
        evidenceQuality: 50,
        recency: 52,
        sensationalismRisk: 42,
      },
      explanation: `${sourceLabel(source)} is listed in the source registry, but its classification is more mixed than top-tier public-interest or mainstream sources. The article gets a moderate starting score and can be refined with deeper checks if needed.`,
      findings: [
        `${sourceLabel(source)} matches a source-registry domain.`,
        `The registry classifies this source as ${safeText(source?.credibilityTier, 'medium')} credibility.`,
        'This gives moderate source support, but not enough for a strong credibility judgment on its own.',
      ],
      limitations: [
        'This immediate score is a source-based baseline, not full article verification.',
        'Source reputation alone does not confirm article-level accuracy.',
      ],
      nextStep: 'Look for corroboration from stronger independent sources before relying on the claims.',
      credibilitySignal: 'medium',
      needsRefinement: false,
    };
  }

  if (classification === 'low') {
    const isSatire = sourceType === 'satire';
    const isSocialPlatform = sourceType === 'social-platform' || sourceType === 'user-generated-platform';
    const isCommunityPlatform = sourceType === 'community-platform';

    let explanation = `${sourceLabel(source)} is classified in the source registry as low credibility for news verification. This article starts with a low credibility score until verified by stronger independent reporting.`;
    let findings = [
      `${sourceLabel(source)} matches a low-support source-registry domain.`,
      'This source type is not treated as strong newsroom evidence by default.',
      'Low source support lowers the immediate credibility baseline.',
    ];

    if (isSatire) {
      explanation = `${sourceLabel(source)} is classified as satire in the source registry. Satire is not treated as factual news reporting, so this article starts with a low credibility score for verification purposes.`;
      findings = [
        `${sourceLabel(source)} is explicitly classified as satire.`,
        'Satirical content is written for parody, not factual reporting.',
        'The article should not be treated as reliable evidence without external verification.',
      ];
    } else if (isSocialPlatform || isCommunityPlatform) {
      explanation = `${sourceLabel(source)} is classified as a user-generated platform rather than a verified newsroom. Posts from this platform are not treated as reliable news evidence by default.`;
      findings = [
        `${sourceLabel(source)} is a user-generated platform, not a newsroom by default.`,
        'Platform content can be authentic, misleading, promotional, or fabricated.',
        'Claims from this source need independent verification before they should be trusted.',
      ];
    }

    return {
      credibilityScore: isSatire ? 14 : isSocialPlatform ? 22 : isCommunityPlatform ? 26 : 28,
      confidenceScore: isSatire ? 42 : 44,
      signalStrength: isSatire ? 12 : 18,
      similarityScore: isSatire ? 6 : isSocialPlatform ? 12 : 18,
      signals: {
        sourceAuthority: isSatire ? 8 : isSocialPlatform ? 18 : 22,
        corroboration: isSatire ? 14 : 20,
        evidenceQuality: isSatire ? 12 : 18,
        recency: 50,
        sensationalismRisk: isSatire ? 92 : isSocialPlatform ? 78 : 72,
      },
      explanation,
      findings,
      limitations: [
        'This immediate score is driven by the source classification, not by a full article fact-check.',
        'A low source baseline does not prove every individual claim is false, but it is not good evidence on its own.',
      ],
      nextStep: 'Treat this article cautiously and verify it with established reporting or official sources.',
      credibilitySignal: 'low',
      needsRefinement: false,
    };
  }

  return {
    credibilityScore: 50,
    confidenceScore: 34,
    signalStrength: 44,
    similarityScore: 0,
    signals: {
      ...DEFAULT_SIGNALS,
    },
    explanation: 'This source is not currently listed in the source registry. The article starts from a neutral credibility baseline until deeper checks can provide more context.',
    findings: [
      'No exact source-registry match was found for this article.',
      'The app starts with a neutral source-based baseline when the source is unknown.',
    ],
    limitations: [
      'No trusted or low-support source classification is available locally for this source.',
      'A neutral starting score is not a credibility endorsement.',
    ],
    nextStep: 'Look for corroboration from established newsrooms or official sources.',
    credibilitySignal: 'unknown',
    needsRefinement: true,
  };
}

function createSimilarityBreakdown(profile, hasExactMatch) {
  return {
    exactDomainBoost: hasExactMatch ? profile.similarityScore : 0,
    semanticBoost: 0,
    metadataBoost: 0,
    totalScore: profile.similarityScore,
  };
}

function buildLocalSourceSimilarity(source, profile) {
  if (!source) {
    return {
      status: 'ready',
      stage: 'local',
      credibilitySignal: 'unknown',
      similarityScore: 0,
      exactDomainMatch: false,
      topMatches: [],
      explanation: profile.explanation,
      note: 'This is a trust signal, not a definitive truth judgment.',
      scoringBreakdown: createSimilarityBreakdown(profile, false),
      matchedDomain: '',
      matchedSource: null,
    };
  }

  return {
    status: 'ready',
    stage: 'local',
    credibilitySignal: profile.credibilitySignal,
    similarityScore: profile.similarityScore,
    exactDomainMatch: true,
    topMatches: [
      {
        sourceName: source.sourceName,
        domain: source.domain,
        score: profile.similarityScore,
        sourceType: source.sourceType,
        credibilityTier: source.credibilityTier,
      },
    ],
    explanation: profile.explanation,
    note: 'This is a trust signal, not a definitive truth judgment.',
    scoringBreakdown: createSimilarityBreakdown(profile, true),
    matchedDomain: sourceDomainLabel(source),
    matchedSource: {
      sourceName: source.sourceName,
      domain: source.domain,
      sourceType: source.sourceType,
      credibilityTier: source.credibilityTier,
    },
  };
}

export function buildInitialArticleCredibility(article, sourceRegistry) {
  const matchedSource = findSourceMatchForArticle(article, sourceRegistry);
  const classification = sourceClassification(matchedSource);
  const profile = sourceSupportProfile(matchedSource, classification);
  const summary = normalizeWhitespace(article?.summary || article?.description);
  const headline = safeText(article?.title || article?.headline, 'Untitled article');

  const derivedAssessment = deriveCredibilityAssessment({
    credibilityScore: profile.credibilityScore,
    confidenceScore: profile.confidenceScore,
    signals: profile.signals,
    verdict: classification === 'high'
      ? 'credible'
      : classification === 'low'
        ? 'not_credible'
        : classification === 'borderline'
          ? 'mixed'
          : 'undetermined',
  });

  const credibilityDetail = {
    headline,
    articleSummary: summary,
    rawVerdict: derivedAssessment.rawVerdict,
    verdict: derivedAssessment.verdict,
    credibilityScore: derivedAssessment.credibilityScore,
    confidenceScore: derivedAssessment.confidenceScore,
    explanation: profile.explanation,
    keyFindings: profile.findings,
    signals: derivedAssessment.signals,
    limitations: profile.limitations,
    recommendedNextStep: profile.nextStep,
    rating: derivedAssessment.rating,
    confidence: derivedAssessment.confidence,
    appCredibility: derivedAssessment.appCredibility,
    evidenceSignalScore: derivedAssessment.evidenceSignalScore,
    combinedScore: derivedAssessment.combinedScore,
    stage: 'local',
  };

  return {
    credibilityStatus: 'ready',
    credibility: derivedAssessment.appCredibility,
    credibilityAnalysis: {
      score: derivedAssessment.credibilityScore,
      rating: derivedAssessment.rating,
      verdict: derivedAssessment.verdict,
      confidence: derivedAssessment.confidence,
      confidenceScore: derivedAssessment.confidenceScore,
      evidenceSignalScore: derivedAssessment.evidenceSignalScore,
      summary: profile.explanation,
      signals: profile.findings.slice(0, 3),
      caveats: profile.limitations,
      stage: 'local',
    },
    credibilityDetail,
    credibleSourceSimilarity: buildLocalSourceSimilarity(matchedSource, profile),
    credibilityScore: derivedAssessment.credibilityScore,
    credibilityLabel: derivedAssessment.verdict,
    credibilityReason: profile.explanation,
    matchedSource: matchedSource
      ? {
          sourceName: matchedSource.sourceName,
          domain: matchedSource.domain,
          sourceType: matchedSource.sourceType,
          credibilityTier: matchedSource.credibilityTier,
        }
      : null,
    lastEvaluatedAt: safeText(article?.lastEvaluatedAt, new Date().toISOString()),
    credibilityStage: 'local',
    credibilityNeedsRefinement: profile.needsRefinement,
  };
}
