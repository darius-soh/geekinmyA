// Article Detail page - full article view with credibility analysis
import { useEffect, useMemo, useReducer } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { deriveCredibilityAssessment } from '../../shared/credibilityModel.js';
import { useLanguage } from '../context/LanguageContext';
import { getArticleById } from '../api/articlesApi';
import { getRelatedArticles } from '../api/credibilityEngine';
import { assessOpenedArticle } from '../api/openaiService';
import CredibilityMeter from '../components/CredibilityMeter';
import CredibleSourceSignalPanel from '../components/CredibleSourceSignalPanel';
import SummaryCard from '../components/SummaryCard';
import RecommendationPanel from '../components/RecommendationPanel';
import SourceSignalPanel from '../components/SourceSignalPanel';
import { Button } from '../components/ui/moving-border';
import {
  articleUsesOriginalLanguage,
  getArticleOriginalLanguage,
  getLocalizedArticleCopy,
} from '../utils/contentLocalization';

function resolveCategoryLabel(t, category) {
  const safeCategory = category || 'world';
  const key = `categories.${safeCategory}`;
  const translated = t(key);
  return translated === key ? safeCategory : translated;
}

function resolveLanguageLabel(t, langCode) {
  const key = `languages.${langCode}`;
  const translated = t(key);
  return translated === key ? langCode.toUpperCase() : translated;
}

function formatPublishedDate(dateValue, language, t) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return t('common.unknown');

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

function mergeArticle(currentArticle, incomingArticle) {
  if (!currentArticle) return incomingArticle;
  if (!incomingArticle) return currentArticle;
  if (currentArticle.id !== incomingArticle.id) return incomingArticle;
  return {
    ...currentArticle,
    ...incomingArticle,
  };
}

function getAnalysisStatus(article) {
  return article?.credibilityStatus === 'ready' && article?.credibilityDetail
    ? 'ready'
    : 'idle';
}

function createDetailState(article, error = null) {
  return {
    sourceId: article?.id || null,
    article,
    analysis: article?.credibilityDetail || null,
    analysisStatus: getAnalysisStatus(article),
    related: [],
    error,
  };
}

function detailReducer(state, action) {
  switch (action.type) {
    case 'hydrateBaseArticle':
      return createDetailState(action.article, action.error || null);
    case 'relatedLoaded':
      if (state.sourceId !== action.sourceId) return state;
      return {
        ...state,
        related: Array.isArray(action.related) ? action.related : [],
      };
    case 'analysisLoading':
      if (state.sourceId !== action.sourceId) return state;
      return {
        ...state,
        analysisStatus: 'loading',
      };
    case 'analysisReady':
      if (state.sourceId !== action.sourceId) return state;
      return {
        ...state,
        article: mergeArticle(state.article, action.article),
        analysis: action.article?.credibilityDetail || null,
        analysisStatus: action.article?.credibilityStatus === 'ready' && action.article?.credibilityDetail
          ? 'ready'
          : 'unavailable',
      };
    case 'analysisUnavailable':
      if (state.sourceId !== action.sourceId) return state;
      return {
        ...state,
        analysisStatus: 'unavailable',
      };
    default:
      return state;
  }
}

export default function ArticleDetail() {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const previewArticle = useMemo(() => {
    const candidate = location.state?.article;
    if (!candidate || typeof candidate !== 'object') return null;
    return candidate.id === id ? candidate : null;
  }, [id, location.state]);

  const baseArticle = useMemo(() => {
    const storedArticle = getArticleById(id, { language });
    if (previewArticle && storedArticle) {
      return mergeArticle(storedArticle, previewArticle);
    }
    return previewArticle || storedArticle || null;
  }, [id, language, previewArticle]);

  const [detailState, dispatch] = useReducer(
    detailReducer,
    createDetailState(baseArticle)
  );
  const {
    article,
    analysis,
    analysisStatus,
    related,
    error,
  } = detailState;
  const articleId = article?.id || null;
  const articleUrl = article?.url || '';
  const articleOriginalUrl = article?.originalUrl || '';
  const articleCanonicalUrl = article?.canonicalUrl || '';
  const articleTitle = article?.title || '';
  const articleSummaryText = article?.summary || '';
  const articleDescription = article?.description || '';
  const articleContent = article?.content || '';
  const articleScrapedContent = article?.scrapedContent || '';
  const articleCategory = article?.category || '';
  const articleSource = article?.source || '';
  const articlePublishedAt = article?.publishedAt || '';
  const articleRequestedLanguage = article?.requestedLanguage || '';
  const articleOriginalLanguage = article?.originalLanguage || '';
  const articleAuthor = article?.author || '';
  const articleImageUrl = article?.imageUrl || '';
  const articleIsFromLiveApi = Boolean(article?.isFromLiveApi);
  const articleCredibilityStatus = article?.credibilityStatus || '';
  const articleCredibilityDetail = article?.credibilityDetail || null;
  const articleCredibilityAnalysis = article?.credibilityAnalysis || null;
  const articleCredibilityNeedsRefinement = Boolean(article?.credibilityNeedsRefinement);

  const relatedArticleSeed = useMemo(() => {
    if (!articleId) return null;

    return {
      id: articleId,
      title: articleTitle,
      summary: articleSummaryText,
      description: articleDescription,
      content: articleContent,
      category: articleCategory,
      source: articleSource,
      publishedAt: articlePublishedAt,
      url: articleUrl,
      originalUrl: articleOriginalUrl,
      requestedLanguage: articleRequestedLanguage,
      originalLanguage: articleOriginalLanguage,
      isFromLiveApi: articleIsFromLiveApi,
    };
  }, [
    articleId,
    articleTitle,
    articleSummaryText,
    articleDescription,
    articleContent,
    articleCategory,
    articleSource,
    articlePublishedAt,
    articleUrl,
    articleOriginalUrl,
    articleRequestedLanguage,
    articleOriginalLanguage,
    articleIsFromLiveApi,
  ]);

  const assessmentArticleSeed = useMemo(() => {
    if (!articleId) return null;

    return {
      ...article,
      id: articleId,
      url: articleUrl,
      originalUrl: articleOriginalUrl,
      canonicalUrl: articleCanonicalUrl,
      title: articleTitle,
      summary: articleSummaryText,
      description: articleDescription,
      publishedAt: articlePublishedAt,
      content: articleContent,
      scrapedContent: articleScrapedContent,
      category: articleCategory,
      source: articleSource,
      requestedLanguage: articleRequestedLanguage,
      originalLanguage: articleOriginalLanguage,
      author: articleAuthor,
      imageUrl: articleImageUrl,
      isFromLiveApi: articleIsFromLiveApi,
      credibilityStatus: articleCredibilityStatus,
      credibilityDetail: articleCredibilityDetail,
      credibilityAnalysis: articleCredibilityAnalysis,
      credibilityNeedsRefinement: articleCredibilityNeedsRefinement,
    };
  }, [
    article,
    articleId,
    articleUrl,
    articleOriginalUrl,
    articleCanonicalUrl,
    articleTitle,
    articleSummaryText,
    articleDescription,
    articlePublishedAt,
    articleContent,
    articleScrapedContent,
    articleCategory,
    articleSource,
    articleRequestedLanguage,
    articleOriginalLanguage,
    articleAuthor,
    articleImageUrl,
    articleIsFromLiveApi,
    articleCredibilityStatus,
    articleCredibilityDetail,
    articleCredibilityAnalysis,
    articleCredibilityNeedsRefinement,
  ]);

  useEffect(() => {
    dispatch({
      type: 'hydrateBaseArticle',
      article: baseArticle,
      error: baseArticle ? null : t('article.notAvailableInLanguage'),
    });
    window.scrollTo(0, 0);
  }, [baseArticle, t]);

  useEffect(() => {
    if (!relatedArticleSeed) return;

    let isActive = true;

    const loadRelated = async () => {
      try {
        const relatedData = await getRelatedArticles(relatedArticleSeed);
        if (!isActive) return;
        dispatch({
          type: 'relatedLoaded',
          sourceId: relatedArticleSeed.id,
          related: relatedData,
        });
      } catch (relatedError) {
        console.warn('Failed to load related articles:', relatedError);
      }
    };

    void loadRelated();

    return () => {
      isActive = false;
    };
  }, [
    relatedArticleSeed,
  ]);

  useEffect(() => {
    if (!assessmentArticleSeed) return;

    const hasImmediateAnalysis = Boolean(
      assessmentArticleSeed.credibilityStatus === 'ready'
      && assessmentArticleSeed.credibilityDetail
    );

    if (hasImmediateAnalysis && !assessmentArticleSeed.credibilityNeedsRefinement) {
      return;
    }

    let isActive = true;
    if (!hasImmediateAnalysis) {
      dispatch({
        type: 'analysisLoading',
        sourceId: assessmentArticleSeed.id,
      });
    }

    void assessOpenedArticle({ article: assessmentArticleSeed, language })
      .then((assessedArticle) => {
        if (!isActive) return;
        if (!assessedArticle) {
          if (hasImmediateAnalysis) return;
          dispatch({
            type: 'analysisUnavailable',
            sourceId: assessmentArticleSeed.id,
          });
          return;
        }

        dispatch({
          type: 'analysisReady',
          sourceId: assessmentArticleSeed.id,
          article: assessedArticle,
        });
      })
      .catch((assessmentError) => {
        console.warn('Credibility assessment failed:', assessmentError);
        if (!isActive) return;
        if (hasImmediateAnalysis) return;
        dispatch({
          type: 'analysisUnavailable',
          sourceId: assessmentArticleSeed.id,
        });
      });

    return () => {
      isActive = false;
    };
  }, [
    assessmentArticleSeed,
    language,
  ]);

  if (error || !article) {
    return (
      <div className="page">
        <div className="container page-content">
          <div className="empty-state">
            <div className="empty-state-icon">{t('common.noticeIcon')}</div>
            <h3 className="empty-state-title">{error || t('common.error')}</h3>
            <Button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: 'var(--space-4)' }}>
              {t('article.backToHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const localizedCopy = getLocalizedArticleCopy(article, language);
  const title = localizedCopy.title || t('article.untitled');
  const articleSummary = localizedCopy.summary
    || localizedCopy.shortDescription
    || localizedCopy.description
    || article.summary
    || article.description
    || '';
  const source = article.source || t('common.unknown');
  const sourceUrl = article.sourceUrl || '';
  const showOriginalLanguageNote = (
    language !== 'en'
    && articleUsesOriginalLanguage(article, language)
  );
  const originalLanguageCode = getArticleOriginalLanguage(article);
  const credibilityDetail = analysis || article.credibilityDetail || null;
  const credibilityCard = article.credibilityAnalysis || null;
  const resolvedAssessment = deriveCredibilityAssessment({
    verdict: credibilityDetail?.verdict || article.credibility,
    credibilityScore: credibilityCard?.score ?? credibilityDetail?.credibilityScore,
    confidenceScore: credibilityDetail?.confidenceScore ?? credibilityCard?.confidenceScore,
    signals: credibilityDetail?.signals,
    rating: credibilityCard?.rating || credibilityDetail?.rating,
  });
  const recommendation = credibilityDetail?.recommendedNextStep
    ? { action: credibilityDetail.recommendedNextStep, resources: [] }
    : null;

  return (
    <div className="page" id="article-detail-page">
      <div className="container page-content">
        <div className="article-detail animate-fade-in">
          <Link to="/" className="article-detail-back" id="back-to-home">
            {t('article.backToHome')}
          </Link>

          <div className="article-detail-hero">
            {article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt={title}
                onError={(event) => {
                  event.currentTarget.src = '';
                }}
              />
            ) : (
              <div
                className="news-card-image"
                style={{ background: 'linear-gradient(135deg, var(--bg-secondary), var(--accent-primary-bg))', height: '100%' }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="article-detail-meta">
            <span className="news-card-category">{resolveCategoryLabel(t, article.category)}</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {t('article.source')}: {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer"><strong>{source}</strong></a>
              ) : (
                <strong>{source}</strong>
              )}
            </span>
            {article.author && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {t('article.author')}: {article.author}
              </span>
            )}
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {t('article.published')}: {formatPublishedDate(article.publishedAt, language, t)}
            </span>
            {showOriginalLanguageNote && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                {t('article.originalLanguage')}: {resolveLanguageLabel(t, originalLanguageCode)}
              </span>
            )}
          </div>

          <h1 className="article-detail-title" id="article-title">
            {title}
          </h1>

          <div className="article-detail-two-col">
            <main className="article-detail-main">
              <SummaryCard summary={articleSummary || t('article.noContentAvailable')} />

              {recommendation && (
                <RecommendationPanel
                  recommendation={recommendation}
                  credibility={resolvedAssessment.appCredibility}
                  relatedArticles={related}
                />
              )}
            </main>

            <aside className="article-detail-sidebar">
              <CredibilityMeter
                credibility={credibilityDetail?.verdict || resolvedAssessment.verdict}
                confidence={credibilityDetail?.confidenceScore ?? credibilityCard?.confidenceScore}
                rating={credibilityDetail?.rating || credibilityCard?.rating}
                score={credibilityCard?.score ?? credibilityDetail?.credibilityScore}
                signals={credibilityDetail?.signals}
                explanation={credibilityDetail?.explanation || credibilityCard?.summary || article.credibilityError}
                status={analysisStatus}
              />

              <CredibleSourceSignalPanel
                signal={article.credibleSourceSimilarity}
                status={analysisStatus}
              />

              {analysisStatus === 'ready' && credibilityDetail?.signals && (
                <SourceSignalPanel signals={credibilityDetail.signals} />
              )}

              {article.url && (
                <Button
                  as="a"
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-full"
                  id="view-original"
                >
                  {t('article.readOriginalArticle')}
                </Button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
