// RelatedArticlesList component — horizontal scroll of related articles
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedField } from '../utils/contentLocalization';

function formatPublishedDate(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(language || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString(language || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

export default function RelatedArticlesList({ articles = [] }) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (!articles.length) return null;

  return (
    <div className="related-articles" id="related-articles">
      {articles.map(article => (
        <div
          key={article.id}
          className="related-article-card"
          onClick={() => navigate(`/article/${article.id}`, {
            state: { article },
          })}
        >
          <img
            src={article.imageUrl}
            alt={article.title}
            loading="lazy"
            onError={(e) => {
              e.target.style.background = 'var(--bg-secondary)';
              e.target.src = '';
            }}
          />
          <div className="related-article-card-body">
            <h4 className="related-article-card-title">{getLocalizedField(article, 'title', language) || article.title}</h4>
            <p className="related-article-card-source">{article.source}</p>
            <p className="related-article-card-date">{formatPublishedDate(article.publishedAt, language)}</p>
            <p className="related-article-card-summary">
              {getLocalizedField(article, 'summary', language)
                || getLocalizedField(article, 'shortDescription', language)
                || article.summary
                || article.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
