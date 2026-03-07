// RecommendationPanel component
import { useLanguage } from '../context/LanguageContext';
import RelatedArticlesList from './RelatedArticlesList';
import { localizeCredibilityText } from '../utils/localizedCredibilityCopy';

export default function RecommendationPanel({ recommendation, credibility, relatedArticles = [] }) {
  const { t } = useLanguage();

  if (!recommendation) return null;

  return (
    <div className="recommendation-panel" id="recommendation-panel">
      <h3 className="recommendation-panel-title">
        {t('article.recommendation')}
      </h3>

      {/* What should you do? */}
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
        {t('article.whatShouldYouDo')}
      </h4>
      <div className="recommendation-action">
        {localizeCredibilityText(recommendation.action, t)}
      </div>

      {/* Official / Trusted Resources */}
      {recommendation.resources && recommendation.resources.length > 0 && (
        <div className="recommendation-resources">
          <h4>{t('article.officialResources')}</h4>
          {recommendation.resources.map((resource, i) => (
            <a
              key={i}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="resource-link"
            >
              {resource.name}
            </a>
          ))}
        </div>
      )}

      {/* Related articles — only show for credible/mixed */}
      {(credibility === 'credible' || credibility === 'mixed') && relatedArticles.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
            {t('article.relatedArticles')}
          </h4>
          <RelatedArticlesList articles={relatedArticles} />
        </div>
      )}
    </div>
  );
}
