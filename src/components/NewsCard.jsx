// NewsCard component - reusable article preview card
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  articleUsesOriginalLanguage,
  getArticleOriginalLanguage,
  getLocalizedArticleCopy,
} from '../utils/contentLocalization';

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

function resolveCategoryLabel(t, category) {
  const key = `categories.${category || 'world'}`;
  const translated = t(key);
  return translated === key ? (category || 'world') : translated;
}

function resolveLanguageLabel(t, languageCode) {
  const key = `languages.${languageCode}`;
  const translated = t(key);
  return translated === key ? (languageCode || 'en').toUpperCase() : translated;
}

export default function NewsCard({ article, featured = false, className = '' }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const localizedCopy = useMemo(
    () => getLocalizedArticleCopy(article, language),
    [article, language]
  );

  if (!article) return null;

  const title = localizedCopy.title || t('article.untitled');
  const summary = localizedCopy.summary
    || localizedCopy.shortDescription
    || localizedCopy.description
    || article.summary
    || article.description
    || '';
  const source = article.source || t('common.unknown');
  const sourceUrl = article.sourceUrl || '';
  const categoryLabel = resolveCategoryLabel(t, article.category);
  const published = formatPublishedDate(article.publishedAt, language);
  const originalLanguageCode = getArticleOriginalLanguage(article);

  const showOriginalLanguageNote = (
    language !== 'en'
    && articleUsesOriginalLanguage(article, language)
  );

  const openArticle = () => {
    if (!article.id) return;
    navigate(`/article/${article.id}`, {
      state: { article },
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openArticle();
    }
  };

  return (
    <article
      className={`news-card ${featured ? 'news-card-featured' : ''} ${className}`.trim()}
      onClick={openArticle}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={title}
    >
      {article.imageUrl ? (
        <img
          className="news-card-image"
          src={article.imageUrl}
          alt={title}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = '';
            event.currentTarget.style.background = 'linear-gradient(135deg, var(--bg-secondary), var(--accent-primary-bg))';
          }}
        />
      ) : (
        <div
          className="news-card-image"
          style={{ background: 'linear-gradient(135deg, var(--bg-secondary), var(--accent-primary-bg))' }}
          aria-hidden="true"
        />
      )}

      <div className="news-card-body">
        <div className="news-card-meta">
          <span className="news-card-category">{categoryLabel}</span>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="news-card-source"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {source}
            </a>
          ) : (
            <span className="news-card-source">{source}</span>
          )}
          {published && <span className="news-card-time">{published}</span>}
        </div>

        <h3 className="news-card-title">{title}</h3>

        <p className="news-card-description">
          {summary || t('article.noContentAvailable')}
        </p>

        {showOriginalLanguageNote && (
          <p
            style={{
              marginTop: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('article.originalLanguage')}: {resolveLanguageLabel(t, originalLanguageCode)}
          </p>
        )}
      </div>
    </article>
  );
}
