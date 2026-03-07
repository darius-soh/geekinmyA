import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getPersonalizedArticles } from '../api/articlesApi';
import NewsCard from './NewsCard';
import { Button } from './ui/moving-border';

export default function ForYouSectionList({
  interests = [],
  limitPerInterest = 3,
  showEmptyState = false,
}) {
  const { t, language } = useLanguage();

  const personalized = useMemo(() => {
    if (!Array.isArray(interests) || interests.length === 0) {
      return {};
    }

    return getPersonalizedArticles(interests, {
      language,
      limitPerInterest,
    });
  }, [interests, language, limitPerInterest]);

  const sections = useMemo(() => (
    interests
      .map((interest) => ({
        interest,
        articles: personalized[interest] || [],
      }))
      .filter(section => section.articles.length > 0)
  ), [interests, personalized]);

  if (interests.length === 0 && showEmptyState) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{t('common.noticeIcon')}</div>
        <h3 className="empty-state-title">{t('forYou.noInterests')}</h3>
        <Button
          as={Link}
          to="/settings"
          className="btn btn-primary"
          style={{ marginTop: 'var(--space-4)' }}
        >
          {t('forYou.manageInterests')}
        </Button>
      </div>
    );
  }

  if (sections.length === 0) {
    if (!showEmptyState) return null;

    return (
      <div className="empty-state">
        <div className="empty-state-icon">{t('common.noticeIcon')}</div>
        <h3 className="empty-state-title">{t('forYou.noArticles')}</h3>
        <Button
          as={Link}
          to="/settings"
          className="btn btn-secondary"
          style={{ marginTop: 'var(--space-4)' }}
        >
          {t('forYou.manageInterests')}
        </Button>
      </div>
    );
  }

  return sections.map(({ interest, articles }) => (
    <section key={interest} className="section animate-fade-in-up">
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: 'var(--text-2xl)' }}>
            {t(`categories.${interest}`)} {t('home.forYou')}
          </h2>
        </div>
      </div>
      <div className="news-grid">
        {articles.slice(0, limitPerInterest).map((article, index) => (
          <NewsCard
            key={article.id}
            article={article}
            className={`stagger-${Math.min(index + 1, 6)}`}
          />
        ))}
      </div>
    </section>
  ));
}
