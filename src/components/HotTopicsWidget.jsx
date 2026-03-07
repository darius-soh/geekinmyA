// HotTopicsWidget component
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getHotTopics } from '../api/articlesApi';
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

export default function HotTopicsWidget({ excludedArticleIds = [] }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const excludedKey = useMemo(() => excludedArticleIds.join('|'), [excludedArticleIds]);
  const topics = useMemo(() => getHotTopics({
    language,
    excludedArticleIds: excludedKey ? excludedKey.split('|') : [],
  }), [excludedKey, language]);

  return (
    <div className="hot-topics" id="hot-topics-widget">
      <h3 className="hot-topics-title">{t('home.whatsHot')}</h3>
      <p className="hot-topics-subtitle">{t('home.whatsHotSubtitle')}</p>

      {topics.length === 0 && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-4)' }}>
          {t('home.noHotTopics')}
        </p>
      )}

      {topics.map((topic, index) => {
        const title = getLocalizedField(topic, 'title', language) || t('article.untitled');
        const summary = getLocalizedField(topic, 'summary', language)
          || getLocalizedField(topic, 'shortDescription', language)
          || getLocalizedField(topic, 'description', language)
          || '';
        const published = formatPublishedDate(topic.publishedAt, language);

        return (
          <div
            key={topic.id || `${title}-${index}`}
            className={`hot-topic-item animate-fade-in-up stagger-${index + 1}`}
            onClick={() => topic.articleId && navigate(`/article/${topic.articleId}`, {
              state: {
                article: {
                  id: topic.articleId,
                  title,
                  shortDescription: getLocalizedField(topic, 'shortDescription', language),
                  summary,
                  description: summary,
                  source: topic.source,
                  sourceUrl: topic.sourceUrl,
                  publishedAt: topic.publishedAt,
                  url: topic.url,
                  originalUrl: topic.url,
                  category: topic.category,
                  isFromLiveApi: topic.isFromLiveApi,
                  originalLanguage: topic.originalLanguage,
                  requestedLanguage: topic.requestedLanguage,
                  translations: topic.translations,
                },
              },
            })}
          >
            <span className={`hot-topic-badge ${topic.type || 'developing'}`}>
              {t(`hotTopics.${topic.type || 'developing'}`)}
            </span>
            <div className="hot-topic-info">
              <h4>{title}</h4>
              <div className="hot-topic-meta">
                {topic.source && <span>{topic.source}</span>}
                {published && <span>{published}</span>}
              </div>
              <p>{summary || t('article.noContentAvailable')}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
