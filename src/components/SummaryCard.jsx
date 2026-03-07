// SummaryCard component - TLDR section
import { useLanguage } from '../context/LanguageContext';
import { localizeCredibilityText } from '../utils/localizedCredibilityCopy';

export default function SummaryCard({ summary = [] }) {
  const { t } = useLanguage();

  const points = Array.isArray(summary)
    ? summary.filter(Boolean)
    : typeof summary === 'string' && summary.trim()
      ? [summary.trim()]
      : [];

  if (!points.length) return null;

  return (
    <div className="summary-card" id="summary-card">
      <h3 className="summary-card-title">{t('article.summary')}</h3>
      <div className="summary-list">
        {points.map((point, index) => (
          <div key={index} className="summary-item">
            <span className="summary-item-text">
              {localizeCredibilityText(point, t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
