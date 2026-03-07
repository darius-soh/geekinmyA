const NUMERIC_SIGNAL_DEFAULTS = {
  sourceAuthority: 50,
  corroboration: 40,
  evidenceQuality: 45,
  recency: 50,
  sensationalismRisk: 50,
};

const NUMERIC_SIGNAL_KEYS = Object.keys(NUMERIC_SIGNAL_DEFAULTS);

export function clampScore(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export function normalizeVerdict(value) {
  if (value === 'notCredible' || value === 'not_credible') return 'not_credible';
  if (value === 'credible') return 'credible';
  if (value === 'mixed') return 'mixed';
  return 'undetermined';
}

export function verdictToAppCredibility(verdict) {
  if (verdict === 'not_credible') return 'notCredible';
  if (verdict === 'credible' || verdict === 'mixed') return verdict;
  return 'undetermined';
}

export function confidenceBand(score) {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function ratingForVerdict(verdict) {
  switch (verdict) {
    case 'credible':
      return 'A';
    case 'mixed':
      return 'B';
    case 'undetermined':
      return 'C';
    case 'not_credible':
    default:
      return 'D';
  }
}

export function getScoreTone(score, options = {}) {
  const safeScore = clampScore(score, 0);
  const adjustedScore = options.invert ? 100 - safeScore : safeScore;

  if (adjustedScore >= 70) return 'credible';
  if (adjustedScore >= 40) return 'mixed';
  return 'notCredible';
}

export function normalizeNumericSignals(rawSignals = {}) {
  const safeSignals = rawSignals && typeof rawSignals === 'object' ? rawSignals : {};

  return {
    sourceAuthority: clampScore(safeSignals.sourceAuthority, NUMERIC_SIGNAL_DEFAULTS.sourceAuthority),
    corroboration: clampScore(safeSignals.corroboration, NUMERIC_SIGNAL_DEFAULTS.corroboration),
    evidenceQuality: clampScore(safeSignals.evidenceQuality, NUMERIC_SIGNAL_DEFAULTS.evidenceQuality),
    recency: clampScore(safeSignals.recency, NUMERIC_SIGNAL_DEFAULTS.recency),
    sensationalismRisk: clampScore(safeSignals.sensationalismRisk, NUMERIC_SIGNAL_DEFAULTS.sensationalismRisk),
  };
}

export function hasNumericSignals(rawSignals = {}) {
  if (!rawSignals || typeof rawSignals !== 'object') return false;
  return NUMERIC_SIGNAL_KEYS.some(key => Number.isFinite(Number(rawSignals[key])));
}

export function computeEvidenceSignalScore(rawSignals = {}) {
  const signals = normalizeNumericSignals(rawSignals);
  const evidenceScore = Math.round(
    (signals.sourceAuthority * 0.28)
    + (signals.corroboration * 0.24)
    + (signals.evidenceQuality * 0.28)
    + (signals.recency * 0.10)
    + ((100 - signals.sensationalismRisk) * 0.10)
  );

  return clampScore(evidenceScore, 50);
}

export function deriveCredibilityAssessment(input = {}) {
  const rawVerdict = normalizeVerdict(input.rawVerdict || input.verdict || input.credibility);
  const credibilityScore = clampScore(
    input.credibilityScore ?? input.score ?? input.confidenceScore ?? input.confidence,
    50
  );
  const rawSignals = input.signals && typeof input.signals === 'object' ? input.signals : {};
  const numericSignalsPresent = hasNumericSignals(rawSignals);
  const signals = normalizeNumericSignals(rawSignals);
  const evidenceSignalScore = numericSignalsPresent
    ? computeEvidenceSignalScore(signals)
    : clampScore(input.evidenceSignalScore ?? credibilityScore, credibilityScore);
  const rawConfidenceScore = clampScore(input.confidenceScore ?? input.confidence, 45);
  const confidenceCap = clampScore(Math.round(((credibilityScore + evidenceSignalScore) / 2) + 10), 55);
  const confidenceScore = Math.min(rawConfidenceScore, confidenceCap);
  const combinedScore = clampScore(Math.round(
    (credibilityScore * 0.60)
    + (evidenceSignalScore * 0.25)
    + (confidenceScore * 0.15)
  ), 50);

  let verdict = 'undetermined';

  if (credibilityScore >= 78 && evidenceSignalScore >= 62 && confidenceScore >= 65) {
    verdict = 'credible';
  } else if (
    credibilityScore <= 34
    && (evidenceSignalScore <= 40 || signals.sensationalismRisk >= 65)
  ) {
    verdict = 'not_credible';
  } else if (
    combinedScore >= 58
    && credibilityScore >= 45
    && evidenceSignalScore >= 45
    && confidenceScore >= 40
  ) {
    verdict = 'mixed';
  } else if (combinedScore < 35) {
    verdict = rawVerdict === 'not_credible' ? 'not_credible' : 'undetermined';
  }

  if (rawVerdict === 'not_credible' && verdict === 'mixed' && credibilityScore < 55) {
    verdict = 'not_credible';
  }

  if (rawVerdict === 'credible' && verdict === 'undetermined' && credibilityScore >= 60 && evidenceSignalScore >= 55) {
    verdict = 'mixed';
  }

  const appCredibility = verdictToAppCredibility(verdict);

  return {
    rawVerdict,
    verdict,
    appCredibility,
    credibilityScore,
    confidenceScore,
    confidence: confidenceBand(confidenceScore),
    rating: ratingForVerdict(verdict),
    evidenceSignalScore,
    combinedScore,
    signals,
    toneClass: appCredibility,
    credibilityTone: getScoreTone(credibilityScore),
    confidenceTone: getScoreTone(confidenceScore),
  };
}
