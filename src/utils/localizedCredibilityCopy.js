function interpolate(template, values = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function getCredibilityVerdictLabel(verdict, t) {
  const normalized = typeof verdict === 'string' ? verdict.trim() : '';
  if (normalized === 'credible') return t('credibility.credible');
  if (normalized === 'mixed') return t('credibility.mixed');
  if (normalized === 'not_credible' || normalized === 'notCredible') return t('credibility.notCredible');
  return t('credibility.undetermined');
}

function getTierLabel(tier, t) {
  const normalized = typeof tier === 'string' ? tier.trim().toLowerCase() : '';
  const key = `credibilityCopy.tiers.${normalized.replace(/-/g, '')}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return normalized.replace(/-/g, ' ') || tier;
}

function getSourceClassificationLabel(description, t) {
  const normalized = typeof description === 'string' ? description.trim().toLowerCase() : '';
  const keyMap = {
    'a satire publication': 'credibilityCopy.classifications.satirePublication',
    'a social platform': 'credibilityCopy.classifications.socialPlatform',
    'a user-generated community platform': 'credibilityCopy.classifications.communityPlatform',
    'a low-credibility source profile': 'credibilityCopy.classifications.lowCredibilityProfile',
    'a source-registry profile': 'credibilityCopy.classifications.registryProfile',
  };

  const key = keyMap[normalized];
  if (!key) return description;

  const translated = t(key);
  return translated !== key ? translated : description;
}

const EXACT_TEXT_KEY_MAP = new Map([
  ['Treat this article cautiously and verify it with established reporting or official sources.', 'credibilityCopy.treatCautiously'],
  ['Read the article and cited primary sources for claim-level verification.', 'credibilityCopy.readPrimarySources'],
  ['Look for corroboration from stronger independent sources before relying on the claims.', 'credibilityCopy.lookForStrongerCorroboration'],
  ['Look for corroboration from established newsrooms or official sources.', 'credibilityCopy.lookForEstablishedCorroboration'],
  ['Do not share this yet. Verify with official agencies and trusted media first.', 'credibilityCopy.doNotShareYet'],
  ['Proceed with caution and confirm the claim with official references.', 'credibilityCopy.proceedWithCaution'],
  ['You can treat this as likely reliable, but still cross-check major claims before sharing.', 'credibilityCopy.likelyReliableCrossCheck'],
  ['Some elements may be correct, but verify key facts with official references before acting on it.', 'credibilityCopy.verifyKeyFacts'],
  ['There is not enough evidence yet. Wait for corroboration from trusted sources before sharing.', 'credibilityCopy.waitForCorroboration'],
  ['Please verify this information using trusted official sources before sharing.', 'credibilityCopy.verifyUsingOfficialSources'],
  ['Summary unavailable. The article body does not contain enough text.', 'credibilityCopy.summaryUnavailableBody'],
  ['Summary unavailable. The article body does not contain enough usable content.', 'credibilityCopy.summaryUnavailableUsable'],
  ['Assessment is based on available linguistic and context signals.', 'credibilityCopy.assessmentBasedOnSignals'],
  ['Current evidence is insufficient for a definitive conclusion.', 'credibilityCopy.currentEvidenceInsufficient'],
  ['This is a strong source-based trust signal, not proof that every claim is accurate.', 'credibilityCopy.strongTrustSignal'],
  ['This gives moderate source support, but not enough for a strong credibility judgment on its own.', 'credibilityCopy.moderateSourceSupport'],
  ['This source type is not treated as strong newsroom evidence by default.', 'credibilityCopy.sourceTypeNotNewsroom'],
  ['Low source support lowers the immediate credibility baseline.', 'credibilityCopy.lowSupportBaseline'],
  ['Satirical content is written for parody, not factual reporting.', 'credibilityCopy.satireParody'],
  ['The article should not be treated as reliable evidence without external verification.', 'credibilityCopy.articleNotReliableEvidence'],
  ['Platform content can be authentic, misleading, promotional, or fabricated.', 'credibilityCopy.platformContentMixed'],
  ['Claims from this source need independent verification before they should be trusted.', 'credibilityCopy.platformClaimsNeedVerification'],
  ['No exact source-registry match was found for this article.', 'credibilityCopy.noExactSourceMatch'],
  ['The app starts with a neutral source-based baseline when the source is unknown.', 'credibilityCopy.neutralSourceBaseline'],
  ['This is a trust signal, not a definitive truth judgment.', 'article.trustSignalNote'],
]);

const PATTERN_MAP = [
  {
    pattern: /^(.*) matches a known source-registry domain\.$/,
    key: 'credibilityCopy.matchesKnownDomain',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^The registry classifies (.*) as (.*) credibility\.$/,
    key: 'credibilityCopy.classifySourceAs',
    getValues: (match, t) => ({
      sourceName: match[1],
      tier: getTierLabel(match[2], t),
    }),
  },
  {
    pattern: /^(.*) matches a source-registry domain\.$/,
    key: 'credibilityCopy.matchesRegistryDomain',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^The registry classifies this source as (.*) credibility\.$/,
    key: 'credibilityCopy.classifyGenericSourceAs',
    getValues: (match, t) => ({ tier: getTierLabel(match[1], t) }),
  },
  {
    pattern: /^(.*) matches a low-support source-registry domain\.$/,
    key: 'credibilityCopy.matchesLowSupportDomain',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^(.*) is explicitly classified as satire\.$/,
    key: 'credibilityCopy.sourceExplicitSatire',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^(.*) is a user-generated platform, not a newsroom by default\.$/,
    key: 'credibilityCopy.sourceUserGenerated',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^Current signals support a (.*) assessment\.$/,
    key: 'credibilityCopy.currentSignalsSupport',
    getValues: (match, t) => ({
      verdict: getCredibilityVerdictLabel(match[1], t),
    }),
  },
  {
    pattern: /^(.*) is listed in the source registry as a (.*)-credibility source\. That provides strong source-reputation support for this article, but it is not a full fact-check of the article's claims\.$/,
    key: 'credibilityCopy.highSourceExplanation',
    getValues: (match, t) => ({
      sourceName: match[1],
      tier: getTierLabel(match[2], t),
    }),
  },
  {
    pattern: /^(.*) is listed in the source registry, but its classification is more mixed than top-tier public-interest or mainstream sources\. The article gets a moderate starting score and can be refined with deeper checks if needed\.$/,
    key: 'credibilityCopy.borderlineSourceExplanation',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^(.*) is classified in the source registry as low credibility for news verification\. This article starts with a low credibility score until verified by stronger independent reporting\.$/,
    key: 'credibilityCopy.lowSourceExplanation',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^(.*) is classified as satire in the source registry\. Satire is not treated as factual news reporting, so this article starts with a low credibility score for verification purposes\.$/,
    key: 'credibilityCopy.satireSourceExplanation',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^(.*) is classified as a user-generated platform rather than a verified newsroom\. Posts from this platform are not treated as reliable news evidence by default\.$/,
    key: 'credibilityCopy.platformSourceExplanation',
    getValues: (match) => ({ sourceName: match[1] }),
  },
  {
    pattern: /^This source is not currently listed in the source registry\. The article starts from a neutral credibility baseline until deeper checks can provide more context\.$/,
    key: 'credibilityCopy.unknownSourceExplanation',
    getValues: () => ({}),
  },
  {
    pattern: /^This claim uses sensational language often associated with misleading content\. Verify it with official sources before sharing\.$/,
    key: 'credibilityCopy.claimSensationalExplanation',
    getValues: () => ({}),
  },
  {
    pattern: /^This claim references official institutions but the specific details are not fully verified yet\.$/,
    key: 'credibilityCopy.claimOfficialUnverified',
    getValues: () => ({}),
  },
  {
    pattern: /^The provided URL could not be fully verified\. Cross-check this claim with trusted outlets before sharing\.$/,
    key: 'credibilityCopy.claimUrlUnverified',
    getValues: () => ({}),
  },
  {
    pattern: /^There is insufficient evidence to verify this claim at the moment\.$/,
    key: 'credibilityCopy.claimInsufficientEvidence',
    getValues: () => ({}),
  },
  {
    pattern: /^Claim reviewed: "(.*)"$/,
    key: 'credibilityCopy.claimReviewed',
    getValues: (match) => ({ claim: match[1] }),
  },
  {
    pattern: /^The matched domain \((.*)\) is classified as (.*), so it should not be treated as strong credibility support\.$/,
    key: 'credibilityCopy.exactDomainLowSupport',
    getValues: (match, t) => ({
      domain: match[1],
      classification: getSourceClassificationLabel(match[2], t),
    }),
  },
  {
    pattern: /^The matched domain \((.*)\) is listed in the source registry with a (.*) credibility tier\.$/,
    key: 'credibilityCopy.exactDomainTier',
    getValues: (match, t) => ({
      domain: match[1],
      tier: getTierLabel(match[2], t),
    }),
  },
  {
    pattern: /^This article comes from a source-registry domain \((.*)\) that is classified as (.*)\. That does not provide meaningful credibility support for news verification, even if some wording overlaps with stronger sources\.$/,
    key: 'credibilityCopy.exactSourceLowSupportExplanation',
    getValues: (match, t) => ({
      domain: match[1],
      classification: getSourceClassificationLabel(match[2], t),
    }),
  },
  {
    pattern: /^This article comes from a source-registry domain \((.*)\) and is also semantically similar to curated source profiles such as (.*)\. That adds source-reputation support, but it is only one credibility factor and not a full fact-check\.$/,
    key: 'credibilityCopy.exactSourceSemanticSupport',
    getValues: (match) => ({
      domain: match[1],
      sources: match[2],
    }),
  },
  {
    pattern: /^This article comes from a source-registry domain \((.*)\) listed in the source database\. That supports source reputation, but it does not by itself verify every claim or framing choice in the article\.$/,
    key: 'credibilityCopy.exactSourceRegistrySupport',
    getValues: (match) => ({ domain: match[1] }),
  },
  {
    pattern: /^This article is most similar to source profiles such as (.*) that are classified as (.*)\. That does not add meaningful credibility support and should be treated cautiously\.$/,
    key: 'credibilityCopy.semanticLowSupportExplanation',
    getValues: (match, t) => ({
      sources: match[1],
      classification: getSourceClassificationLabel(match[2], t),
    }),
  },
  {
    pattern: /^This article is semantically similar to source-registry profiles such as (.*)\. That suggests some alignment with established editorial or public-interest sources, but similarity alone does not confirm that the article is fully accurate or complete\.$/,
    key: 'credibilityCopy.semanticSimilaritySupport',
    getValues: (match) => ({ sources: match[1] }),
  },
  {
    pattern: /^The source registry is available for exact domain matching, but the Pinecone similarity index is not ready yet\. This signal currently provides limited support and should not be treated as a fact-check\.$/,
    key: 'credibilityCopy.pineconeNotReady',
    getValues: () => ({}),
  },
  {
    pattern: /^No strong source-registry similarity was found for this article\. That does not prove the article is unreliable, but it provides little additional source-reputation support\.$/,
    key: 'credibilityCopy.noStrongSimilarity',
    getValues: () => ({}),
  },
];

export function localizeCredibilityText(text, t) {
  if (typeof text !== 'string') return text;

  const normalizedText = text.trim();
  if (!normalizedText) return text;

  const directKey = EXACT_TEXT_KEY_MAP.get(normalizedText);
  if (directKey) {
    return t(directKey);
  }

  for (const { pattern, key, getValues } of PATTERN_MAP) {
    const match = normalizedText.match(pattern);
    if (!match) continue;
    return interpolate(t(key), getValues(match, t));
  }

  return text;
}

export function localizeCredibilityList(items, t) {
  if (!Array.isArray(items)) return [];
  return items.map(item => localizeCredibilityText(item, t));
}

export default {
  localizeCredibilityText,
  localizeCredibilityList,
};
