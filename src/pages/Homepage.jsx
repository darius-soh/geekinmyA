// Homepage - main news feed with trending and hot topics
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  NEWS_CATEGORIES,
  getTrendingArticles,
} from '../api/articlesApi';
import NewsCard from '../components/NewsCard';
import CategoryTabs from '../components/CategoryTabs';
import HotTopicsWidget from '../components/HotTopicsWidget';

export default function Homepage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');

  const [activeCategory, setActiveCategory] = useState(categoryFilter);
  const [showSettingsSaved, setShowSettingsSaved] = useState(Boolean(location.state?.settingsSaved));

  const trending = useMemo(
    () => getTrendingArticles({ language }),
    [language]
  );

  useEffect(() => {
    setActiveCategory(categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    if (!location.state?.settingsSaved) return undefined;

    setShowSettingsSaved(true);
    const timer = window.setTimeout(() => {
      setShowSettingsSaved(false);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, location.state, navigate]);

  const filteredTrending = activeCategory
    ? trending.filter(article => article.category === activeCategory)
    : trending;

  const allCategories = NEWS_CATEGORIES;

  return (
    <div className="page" id="homepage">
      <div className="container page-content">
        {user && (
          <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {t('home.welcomeBack')} <strong>{user.username}</strong>
            </p>
            {showSettingsSaved && (
              <div className="settings-saved" style={{ marginTop: 'var(--space-2)' }}>
                {t('settings.saved')}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-8)', alignItems: 'start' }}>
          <div>
            <section className="section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">{t('home.trending')}</h2>
                  <p className="section-subtitle">{t('home.trendingSubtitle')}</p>
                </div>
              </div>

              <CategoryTabs
                categories={allCategories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />

              {filteredTrending.length > 0 ? (
                <div style={{ marginTop: 'var(--space-6)' }}>
                  {!activeCategory && filteredTrending[0] && (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                      <NewsCard article={filteredTrending[0]} featured className="stagger-1" />
                    </div>
                  )}

                  <div className="news-grid">
                    {(activeCategory ? filteredTrending : filteredTrending.slice(1)).map((article, index) => (
                      <NewsCard
                        key={article.id}
                        article={article}
                        className={`stagger-${Math.min(index + 1, 6)}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">{t('common.noticeIcon')}</div>
                  <h3 className="empty-state-title">{t('home.noArticles')}</h3>
                </div>
              )}
            </section>

          </div>

          <aside className="sidebar" style={{ position: 'sticky', top: 'calc(var(--nav-height) + var(--space-6))' }}>
            <HotTopicsWidget excludedArticleIds={trending.slice(0, 8).map(article => article.id)} />
          </aside>
        </div>
      </div>
    </div>
  );
}
