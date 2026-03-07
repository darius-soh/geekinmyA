import { useLanguage } from '../context/LanguageContext';
import { getScoreTone } from '../../shared/credibilityModel.js';

const legacySignalKeys = [
  { key: 'sourceReputation' },
  { key: 'consistency' },
  { key: 'crossSource' },
  { key: 'evidencePresent' },
  { key: 'headlineTone' },
  { key: 'recency' },
  { key: 'officialSources' },
];

const scoredSignalKeys = [
  { key: 'sourceAuthority', invert: false },
  { key: 'corroboration', invert: false },
  { key: 'evidenceQuality', invert: false },
  { key: 'recency', invert: false },
  { key: 'sensationalismRisk', invert: true },
];

function formatSignalValue(value, t) {
  if (typeof value === 'boolean') return value ? t('signals.yes') : t('signals.no');
  if (typeof value === 'string') return t(`signals.${value}`) || value;
  return String(value);
}

function getSignalClass(value) {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return value;
}

function SignalBar({ label, score, invert = false }) {
  const toneClass = getScoreTone(score, { invert });

  return (
    <div className="signal-bar-row">
      <span className="signal-bar-label">
        {label}
      </span>
      <div className="signal-bar-track">
        <div
          className={`signal-bar-fill ${toneClass}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`signal-bar-score ${toneClass}`}>
        {score}
      </span>
    </div>
  );
}

export default function SourceSignalPanel({ signals }) {
  const { t } = useLanguage();

  if (!signals) return null;

  const hasScoredSignals = scoredSignalKeys.some(({ key }) => typeof signals[key] === 'number');

  if (hasScoredSignals) {
    return (
      <div className="signal-panel" id="signal-panel">
        <h3 className="signal-panel-title">{t('article.signals')}</h3>
        <p className="signal-panel-helper">{t('article.signalsHelp')}</p>
        {scoredSignalKeys.map(({ key, invert }) => {
          const value = signals[key];
          if (typeof value !== 'number') return null;

          return (
            <SignalBar
              key={key}
              label={t(`signals.${key}`)}
              score={value}
              invert={invert}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="signal-panel" id="signal-panel">
      <h3 className="signal-panel-title">{t('article.signals')}</h3>
      <p className="signal-panel-helper">{t('article.signalsHelp')}</p>
      <div className="signal-grid">
        {legacySignalKeys.map(({ key }) => {
          const value = signals[key];
          if (value === undefined) return null;

          return (
            <div key={key} className="signal-item">
              <span className="signal-label">{t(`signals.${key}`)}</span>
              <span className={`signal-value ${getSignalClass(value)}`}>
                {formatSignalValue(value, t)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
