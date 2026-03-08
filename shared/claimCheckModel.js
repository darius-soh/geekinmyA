const QUESTION_OPENERS = /^(is|are|did|does|do|was|were|can|could|has|have|had|who|what|when|where|why|how)\b/i;
const AUXILIARY_VERBS = new Set(['is', 'are', 'was', 'were', 'can', 'could', 'has', 'have', 'had', 'will', 'would', 'should']);
const QUESTION_WORDS = new Set(['who', 'what', 'when', 'where', 'why', 'how']);
const IRREGULAR_PAST_TENSE = new Map([
  ['ban', 'banned'],
  ['be', 'was'],
  ['become', 'became'],
  ['buy', 'bought'],
  ['come', 'came'],
  ['do', 'did'],
  ['eat', 'ate'],
  ['go', 'went'],
  ['have', 'had'],
  ['leave', 'left'],
  ['make', 'made'],
  ['run', 'ran'],
  ['say', 'said'],
  ['take', 'took'],
  ['win', 'won'],
  ['write', 'wrote'],
]);

export const CLAIM_INPUT_TYPES = {
  URL_ARTICLE: 'url_article',
  PLAIN_CLAIM: 'plain_claim',
  OPEN_ENDED_QUESTION: 'open_ended_question',
  SCREENSHOT_OR_EXTRACTED_TEXT: 'screenshot_or_extracted_text',
};

export const CLAIM_VERDICTS = {
  SUPPORTED: 'supported',
  LIKELY_SUPPORTED: 'likely_supported',
  MIXED: 'mixed',
  LIKELY_UNSUPPORTED: 'likely_unsupported',
  UNSUPPORTED: 'unsupported',
};

export function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

export function clampScore(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function extractFirstUrl(value) {
  const input = normalizeWhitespace(value);
  if (!input) return '';

  const match = input.match(/\b((?:https?:\/\/|www\.)[^\s<>"']+)/i);
  if (!match) return '';

  const candidate = match[1];
  if (/^www\./i.test(candidate)) {
    return `https://${candidate}`;
  }

  return candidate;
}

export function looksLikeUrl(value) {
  const candidate = safeText(value);
  if (!candidate) return false;

  try {
    const parsed = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function detectClaimInputType({
  text = '',
  url = '',
  fileName = '',
  fromScreenshot = false,
} = {}) {
  const normalizedText = normalizeWhitespace(text);
  const normalizedUrl = safeText(url) || extractFirstUrl(normalizedText);

  if (looksLikeUrl(normalizedUrl)) {
    return CLAIM_INPUT_TYPES.URL_ARTICLE;
  }

  if (fromScreenshot || safeText(fileName)) {
    return CLAIM_INPUT_TYPES.SCREENSHOT_OR_EXTRACTED_TEXT;
  }

  if (
    normalizedText.endsWith('?')
    || QUESTION_OPENERS.test(normalizedText)
  ) {
    return CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION;
  }

  return CLAIM_INPUT_TYPES.PLAIN_CLAIM;
}

function sentenceCase(value) {
  const text = normalizeWhitespace(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeOfficeCapitalization(value) {
  return normalizeWhitespace(value)
    .replace(/\bprime minister\b/gi, 'Prime Minister')
    .replace(/\bdeputy prime minister\b/gi, 'Deputy Prime Minister')
    .replace(/\bpresident\b/gi, 'President')
    .replace(/\bminister\b/gi, 'Minister');
}

function ensureTerminalPeriod(value) {
  const text = normalizeWhitespace(value).replace(/[.?!]+$/, '');
  return text ? `${text}.` : '';
}

function toPastTense(verb) {
  const normalizedVerb = safeText(verb).toLowerCase();
  if (!normalizedVerb) return '';
  if (IRREGULAR_PAST_TENSE.has(normalizedVerb)) {
    return IRREGULAR_PAST_TENSE.get(normalizedVerb);
  }
  if (normalizedVerb.endsWith('e')) return `${normalizedVerb}d`;
  if (/[bcdfghjklmnpqrstvwxyz]y$/.test(normalizedVerb)) {
    return `${normalizedVerb.slice(0, -1)}ied`;
  }
  if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalizedVerb) && normalizedVerb.length <= 5) {
    return `${normalizedVerb}${normalizedVerb.slice(-1)}ed`;
  }
  return `${normalizedVerb}ed`;
}

function toThirdPersonSingular(verb) {
  const normalizedVerb = safeText(verb).toLowerCase();
  if (!normalizedVerb) return '';
  if (normalizedVerb === 'have') return 'has';
  if (/[bcdfghjklmnpqrstvwxyz]y$/.test(normalizedVerb)) {
    return `${normalizedVerb.slice(0, -1)}ies`;
  }
  if (/(s|sh|ch|x|z|o)$/.test(normalizedVerb)) {
    return `${normalizedVerb}es`;
  }
  return `${normalizedVerb}s`;
}

function removeQuestionMark(value) {
  return normalizeWhitespace(value).replace(/[?]+$/, '').trim();
}

function parseYesNoQuestion(value) {
  const sanitized = removeQuestionMark(value);
  const titledSubjectText = sanitized.replace(/^is\s+/i, '');
  const titledPrefixMatch = titledSubjectText.match(/^(pm|prime minister|president|dpm|deputy prime minister|dr|mr|mrs|ms)\s+(.+)$/i);
  if (titledPrefixMatch) {
    const personMatch = titledPrefixMatch[2].match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(.+)$/);
    if (personMatch) {
      const [, personName, predicate] = personMatch;
      return ensureTerminalPeriod(`${personName} is ${normalizeOfficeCapitalization(predicate)}`);
    }
  }

  const match = sanitized.match(/^(is|are|was|were|can|could|has|have|had)\s+(.+?)\s+(.+)$/i);
  if (match) {
    const [, auxiliary, subject, predicate] = match;
    return ensureTerminalPeriod(`${subject} ${auxiliary.toLowerCase()} ${normalizeOfficeCapitalization(predicate)}`);
  }

  const didMatch = sanitized.match(/^did\s+(.+?)\s+([a-z][a-z-]*)\s+(.+)$/i);
  if (didMatch) {
    const [, subject, verb, rest] = didMatch;
    return ensureTerminalPeriod(`${subject} ${toPastTense(verb)} ${rest}`);
  }

  const doesMatch = sanitized.match(/^does\s+(.+?)\s+([a-z][a-z-]*)\s+(.+)$/i);
  if (doesMatch) {
    const [, subject, verb, rest] = doesMatch;
    return ensureTerminalPeriod(`${subject} ${toThirdPersonSingular(verb)} ${rest}`);
  }

  const doMatch = sanitized.match(/^do\s+(.+?)\s+([a-z][a-z-]*)\s+(.+)$/i);
  if (doMatch) {
    const [, subject, verb, rest] = doMatch;
    return ensureTerminalPeriod(`${subject} ${verb.toLowerCase()} ${rest}`);
  }

  return '';
}

function buildClaimTemplateForWhQuestion(questionWord, body) {
  const normalizedBody = sentenceCase(removeQuestionMark(body));
  if (!normalizedBody) return null;

  if (questionWord === 'who') {
    return `${normalizedBody} is {answer}.`;
  }

  if (questionWord === 'when') {
    return `${normalizedBody} happened on {answer}.`;
  }

  if (questionWord === 'where') {
    return `${normalizedBody} is in {answer}.`;
  }

  if (questionWord === 'what') {
    return `${normalizedBody} is {answer}.`;
  }

  return `{answer} ${normalizedBody}.`;
}

export function normalizeQuestionToClaimHeuristic(input) {
  const question = normalizeWhitespace(input);
  if (!question) {
    return {
      normalizedClaim: null,
      questionType: 'unknown',
      needsAnswerFromEvidence: false,
      claimTemplate: null,
    };
  }

  const stripped = removeQuestionMark(question);
  const [firstWord = ''] = stripped.split(/\s+/);
  const questionType = firstWord.toLowerCase();

  if (QUESTION_WORDS.has(questionType)) {
    const body = stripped.slice(firstWord.length).trim();
    return {
      normalizedClaim: null,
      questionType,
      needsAnswerFromEvidence: true,
      claimTemplate: buildClaimTemplateForWhQuestion(questionType, body),
    };
  }

  const normalizedClaim = parseYesNoQuestion(question) || ensureTerminalPeriod(stripped);

  return {
    normalizedClaim: sentenceCase(normalizedClaim),
    questionType: AUXILIARY_VERBS.has(questionType) ? 'yes_no' : questionType || 'yes_no',
    needsAnswerFromEvidence: false,
    claimTemplate: null,
  };
}

export function normalizeQuestionToClaim(input) {
  return normalizeQuestionToClaimHeuristic(input);
}

export function verdictFromClaimSupportScore(score) {
  const safeScore = clampScore(score, 50);
  if (safeScore >= 85) return CLAIM_VERDICTS.SUPPORTED;
  if (safeScore >= 70) return CLAIM_VERDICTS.LIKELY_SUPPORTED;
  if (safeScore >= 40) return CLAIM_VERDICTS.MIXED;
  if (safeScore >= 20) return CLAIM_VERDICTS.LIKELY_UNSUPPORTED;
  return CLAIM_VERDICTS.UNSUPPORTED;
}

export function legacyCredibilityFromVerdict(verdict) {
  if (verdict === CLAIM_VERDICTS.SUPPORTED || verdict === CLAIM_VERDICTS.LIKELY_SUPPORTED) {
    return 'credible';
  }
  if (verdict === CLAIM_VERDICTS.LIKELY_UNSUPPORTED || verdict === CLAIM_VERDICTS.UNSUPPORTED) {
    return 'notCredible';
  }
  return 'mixed';
}

export function deriveConfidence({
  evidence = [],
  retrievalFailed = false,
  ambiguous = false,
  outdated = false,
  contradictory = false,
  fallback = 58,
} = {}) {
  const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
  let confidence = 42 + Math.min(24, evidenceCount * 12);

  if (contradictory) confidence -= 14;
  if (outdated) confidence -= 10;
  if (ambiguous) confidence -= 12;
  if (retrievalFailed) confidence -= 18;

  if (evidenceCount === 0) {
    confidence = Math.min(confidence, fallback);
  }

  return clampScore(confidence, fallback);
}

export function normalizeEvidenceList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      title: normalizeWhitespace(item?.title),
      url: safeText(item?.url),
      source: normalizeWhitespace(item?.source),
      snippet: normalizeWhitespace(item?.snippet),
      stance: ['supports', 'contradicts', 'context'].includes(item?.stance) ? item.stance : 'context',
    }))
    .filter(item => item.title || item.url || item.source || item.snippet);
}

export function buildClaimCheckResult(raw = {}) {
  const evidence = normalizeEvidenceList(raw.evidence);
  const claimSupportScore = clampScore(raw.claimSupportScore, 50);
  const verdict = raw.verdict || verdictFromClaimSupportScore(claimSupportScore);

  return {
    inputType: raw.inputType || CLAIM_INPUT_TYPES.PLAIN_CLAIM,
    originalInput: safeText(raw.originalInput),
    normalizedClaim: safeText(raw.normalizedClaim) || null,
    sourceCredibilityScore: raw.sourceCredibilityScore === null || raw.sourceCredibilityScore === undefined
      ? null
      : clampScore(raw.sourceCredibilityScore, 50),
    claimSupportScore,
    verdict,
    confidence: clampScore(raw.confidence, 45),
    explanation: normalizeWhitespace(raw.explanation),
    evidence,
    limitations: Array.isArray(raw.limitations)
      ? raw.limitations.map(item => normalizeWhitespace(item)).filter(Boolean)
      : [],
  };
}
