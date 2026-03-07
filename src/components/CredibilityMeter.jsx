// CredibilityMeter component - visual credibility gauge
import { deriveCredibilityAssessment, getScoreTone } from '../../shared/credibilityModel.js';
import { useLanguage } from '../context/LanguageContext';
import { localizeCredibilityText } from '../utils/localizedCredibilityCopy';

function MetricRow({ label, score, invert = false }) {
  const toneClass = getScoreTone(score, { invert });

  return (
    <div className="credibility-meter-metric-row">
      <span className="credibility-meter-metric-label">{label}</span>
      <div className="confidence-bar">
        <div
          className={`confidence-bar-fill ${toneClass}`}
          style={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }}
        />
      </div>
      <span className={`credibility-meter-metric-score ${toneClass}`}>{score}/100</span>
    </div>
  );
}

function resolveConfidenceLabel(t, assessment) {
  return t(`signals.${assessment.confidence}`) || assessment.confidence;
}

export default function CredibilityMeter({
  credibility,
  confidence,
  explanation,
  rating,
  score,
  signals,
  status = 'ready',
}) {
  const { t } = useLanguage();

  if (status === 'unavailable') {
    return (
      <div className="credibility-meter" id="credibility-meter">
        <div className="credibility-meter-label undetermined">
          {t('article.credibilityUnavailable')}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="credibility-meter credibility-meter-loading" id="credibility-meter">
        <div className="credibility-meter-header">
          <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-lg)' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text short" style={{ height: '24px', marginBottom: 'var(--space-2)' }} />
            <div className="skeleton skeleton-text medium" style={{ height: '14px' }} />
          </div>
        </div>
        <div className="credibility-meter-metrics">
          <div className="skeleton skeleton-text" style={{ height: '18px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-text" style={{ height: '18px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton skeleton-text" style={{ height: '18px' }} />
        </div>
      </div>
    );
  }

  const assessment = deriveCredibilityAssessment({
    verdict: credibility,
    credibilityScore: score,
    confidenceScore: confidence,
    signals,
    rating,
  });
  const label = t(`credibility.${assessment.appCredibility}`);
  const confidenceLabel = resolveConfidenceLabel(t, assessment);
  const displayExplanation = localizeCredibilityText(explanation || '', t);

  return (
    <div className="credibility-meter" id="credibility-meter">
      <div className="credibility-meter-header">
        <div className={`credibility-meter-icon ${assessment.appCredibility}`}>
          {assessment.rating}
        </div>
        <div>
          <div className={`credibility-meter-label ${assessment.appCredibility}`}>
            {label}
          </div>
          <div className="credibility-meter-confidence">
            {t('article.credibility')}: {assessment.credibilityScore}/100 · {t('article.confidence')}: {confidenceLabel} ({assessment.confidenceScore}/100)
          </div>
        </div>
      </div>

      <div className="credibility-meter-metrics">
        <MetricRow label={t('article.credibility')} score={assessment.credibilityScore} />
        <MetricRow label={t('article.confidence')} score={assessment.confidenceScore} />
        <MetricRow label={t('article.signalStrength')} score={assessment.evidenceSignalScore} />
      </div>

      {displayExplanation && (
        <div className="credibility-meter-explanation">
          {displayExplanation}
        </div>
      )}
    </div>
  );
}
