import { useLanguage } from '../context/LanguageContext';
import { localizeCredibilityText } from '../utils/localizedCredibilityCopy';

function resolveSignalTone(signalLevel) {
  if (signalLevel === 'high') return 'credible';
  if (signalLevel === 'medium') return 'mixed';
  if (signalLevel === 'low') return 'notCredible';
  return 'undetermined';
}

function resolveSignalLabel(signalLevel, t) {
  if (signalLevel === 'high') return t('signals.high');
  if (signalLevel === 'medium') return t('signals.medium');
  if (signalLevel === 'low') return t('signals.low');
  return t('common.unknown');
}

export default function CredibleSourceSignalPanel({ signal, status = 'ready' }) {
  const { t } = useLanguage();

  if (status === 'loading') {
    return (
      <div className="source-similarity-panel" id="credible-source-similarity-panel">
        <div className="source-similarity-header">
          <h3 className="source-similarity-title">{t('article.trustedSourceSimilarity')}</h3>
        </div>
        <p className="source-similarity-explanation">{t('article.assessingTrustedSourceSimilarity')}</p>
      </div>
    );
  }

  if (!signal) return null;

  if (signal.status === 'unavailable') {
    return (
      <div className="source-similarity-panel" id="credible-source-similarity-panel">
        <div className="source-similarity-header">
          <h3 className="source-similarity-title">{t('article.trustedSourceSimilarity')}</h3>
        </div>
        <p className="source-similarity-explanation">
          {localizeCredibilityText(signal.explanation || t('article.trustedSourceSimilarityUnavailable'), t)}
        </p>
        <p className="source-similarity-note">
          {localizeCredibilityText(signal.note || t('article.trustSignalNote'), t)}
        </p>
      </div>
    );
  }

  const signalTone = resolveSignalTone(signal.credibilitySignal);
  const signalLabel = resolveSignalLabel(signal.credibilitySignal, t);
  const topMatches = Array.isArray(signal.topMatches) ? signal.topMatches : [];

  return (
    <div className="source-similarity-panel" id="credible-source-similarity-panel">
      <div className="source-similarity-header">
        <h3 className="source-similarity-title">{t('article.trustedSourceSimilarity')}</h3>
        <span className={`source-similarity-pill ${signalTone}`}>
          {signalLabel}
        </span>
      </div>

      <div className="source-similarity-meta">
        <span>{t('article.similarityScore')}: {signal.similarityScore ?? 0}/100</span>
        {signal.exactDomainMatch && (
          <span className="source-similarity-exact-match">{t('article.exactDomainMatch')}</span>
        )}
      </div>

      <p className="source-similarity-explanation">{localizeCredibilityText(signal.explanation, t)}</p>

      {topMatches.length > 0 ? (
        <div className="source-similarity-match-block">
          <h4 className="source-similarity-subtitle">{t('article.topMatchedSources')}</h4>
          <div className="source-similarity-match-list">
            {topMatches.map((match) => (
              <div key={`${match.domain}-${match.sourceName}`} className="source-similarity-match-item">
                <div>
                  <strong>{match.sourceName}</strong>
                  <div className="source-similarity-match-domain">{match.domain}</div>
                </div>
                <div className="source-similarity-match-score">
                  {match.score}/100
                  <span>
                    {match.sourceType} · {match.credibilityTier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="source-similarity-empty">{t('article.noTrustedSourceMatches')}</p>
      )}

      <p className="source-similarity-note">
        {localizeCredibilityText(signal.note || t('article.trustSignalNote'), t)}
      </p>
    </div>
  );
}
