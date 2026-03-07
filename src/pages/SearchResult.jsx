// Search Result page — displays credibility analysis from OpenAI or local engine
// Handles both OpenAI structured response and legacy local format
import { useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import CredibleSourceSignalPanel from '../components/CredibleSourceSignalPanel';
import CredibilityMeter from '../components/CredibilityMeter';
import SourceSignalPanel from '../components/SourceSignalPanel';
import { Button } from '../components/ui/moving-border';
import {
  localizeCredibilityList,
  localizeCredibilityText,
} from '../utils/localizedCredibilityCopy';

export default function SearchResult() {
  const { t } = useLanguage();
  const location = useLocation();
  const result = location.state?.result;
  const source = location.state?.source || 'local'; // 'openai' or 'local'
  const aiError = location.state?.aiError;

  if (!result) {
    return (
      <div className="page">
        <div className="container page-content">
          <div className="empty-state">
            <div className="empty-state-icon">{t('common.noticeIcon')}</div>
            <h3 className="empty-state-title">{t('common.noResults')}</h3>
            <Button
              as={Link}
              to="/search"
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-4)' }}
            >
              {t('search.newSearch')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normalize result to handle both formats
  const isOpenAI = source === 'openai';
  const headline = result.headline || result.originalClaim || '';
  const summary = result.articleSummary || result.summary || '';
  const explanation = result.explanation || '';
  const keyFindings = localizeCredibilityList(
    Array.isArray(result.keyFindings) ? result.keyFindings : [],
    t
  );
  const timeline = Array.isArray(result.timeline) ? result.timeline : [];
  const recommendedNextStep = localizeCredibilityText(
    result.recommendedNextStep || result.recommendation?.action || '',
    t
  );
  const relatedResources = Array.isArray(result.relatedResourceHints) ? result.relatedResourceHints : [];
  const signals = result.signals && typeof result.signals === 'object' ? result.signals : null;
  const detectedLanguage = result.detectedLanguage || 'en';
  const credibleSourceSimilarity = result.credibleSourceSimilarity || null;

  const resolveLanguageLabel = (languageCode) => {
    const key = `languages.${languageCode}`;
    const translated = t(key);
    return translated === key ? (languageCode || 'en').toUpperCase() : translated;
  };

  return (
    <div className="page" id="search-result-page">
      <div className="container page-content">
        <div className="search-result-page animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* Back to search */}
          <Link to="/search" className="article-detail-back" id="back-to-search">
            {t('search.newSearch')}
          </Link>

          {/* AI source indicator */}
          {aiError && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--mixed-bg)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--mixed)',
              marginBottom: 'var(--space-4)',
            }}>
              {t('search.aiUnavailable')} ({aiError}). {t('search.showingLocalAnalysis')}
            </div>
          )}

          {/* Original claim */}
          <div className="search-result-claim" id="result-claim">
            <div className="search-result-claim-label">{t('search.claim')}</div>
            <div className="search-result-claim-text">{result.originalClaim || headline}</div>
          </div>

          {/* Detected language + source badge */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div className="search-result-detected-lang">
              {t('search.detectedLanguage')}: <strong style={{ marginLeft: '4px' }}>{resolveLanguageLabel(detectedLanguage)}</strong>
            </div>
            {isOpenAI && (
              <div className="search-result-detected-lang" style={{ background: 'var(--accent-primary-bg)', color: 'var(--accent-primary)' }}>
                {t('search.poweredByAI')}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <CredibilityMeter
              credibility={result.verdict || result.credibility}
              confidence={result.confidenceScore ?? result.confidence}
              score={result.credibilityScore ?? result.score ?? result.confidence}
              signals={signals}
              explanation={explanation}
              rating={result.rating}
            />
          </div>

          {credibleSourceSimilarity && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <CredibleSourceSignalPanel signal={credibleSourceSimilarity} />
            </div>
          )}

          {/* ── HEADLINE ────────────────────────────────────────────── */}
          {headline && headline !== result.originalClaim && (
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              marginBottom: 'var(--space-6)',
              lineHeight: 'var(--leading-snug)',
            }}>
              {headline}
            </h2>
          )}

          {/* ── SUMMARY ─────────────────────────────────────────────── */}
          {summary && (
            <div className="summary-card" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 className="summary-card-title">{t('article.summary')}</h3>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-normal)',
              }}>
                {typeof summary === 'string'
                  ? localizeCredibilityText(summary, t)
                  : localizeCredibilityList(summary, t).join(' ')}
              </p>
            </div>
          )}

          {/* ── KEY FINDINGS ────────────────────────────────────────── */}
          {Array.isArray(keyFindings) && keyFindings.length > 0 && (
            <div className="summary-card" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 className="summary-card-title">{t('search.keyFindings')}</h3>
              <div className="summary-list">
                {keyFindings.map((finding, i) => (
                  <div key={i} className="summary-item">{finding}</div>
                ))}
              </div>
            </div>
          )}

          {signals && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <SourceSignalPanel signals={signals} />
            </div>
          )}

          {/* ── TIMELINE ────────────────────────────────────────────── */}
          {timeline.length > 0 && (
            <div style={{
              marginBottom: 'var(--space-6)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-light)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                marginBottom: 'var(--space-5)',
              }}>
                {t('search.timeline')}
              </h3>
              {timeline.map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-3) 0',
                  borderLeft: '2px solid var(--accent-primary)',
                  paddingLeft: 'var(--space-4)',
                  marginLeft: 'var(--space-2)',
                  position: 'relative',
                  marginBottom: i < timeline.length - 1 ? 'var(--space-2)' : 0,
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '-6px',
                    top: 'var(--space-3)',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                  }} />
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {item.date}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                      {item.event}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                      {t('search.timelineSource')}: {item.sourceLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── RECOMMENDATION ──────────────────────────────────────── */}
          {recommendedNextStep && (
            <div className="recommendation-panel" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 className="recommendation-panel-title">
                {t('article.whatShouldYouDo')}
              </h3>
              <div className="recommendation-action">
                {recommendedNextStep}
              </div>
            </div>
          )}

          {/* ── RELATED RESOURCES ───────────────────────────────────── */}
          {relatedResources.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-light)',
              padding: 'var(--space-6)',
              marginBottom: 'var(--space-6)',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                marginBottom: 'var(--space-4)',
              }}>
                {t('search.relatedResources')}
              </h3>
              {relatedResources.map((res, i) => (
                <div key={i} style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--accent-primary-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-2)',
                }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--accent-primary)' }}>
                    {res.label}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    {res.reason}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legacy resources for local engine */}
          {!isOpenAI && result.recommendation?.resources?.length > 0 && (
            <div className="recommendation-panel">
              <h3 className="recommendation-panel-title">{t('article.officialResources')}</h3>
              {result.recommendation.resources.map((resource, i) => (
                <a key={i} href={resource.url} target="_blank" rel="noopener noreferrer" className="resource-link">
                  {resource.name}
                </a>
              ))}
            </div>
          )}

          {/* ── NEW SEARCH ──────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
            <Button as={Link} to="/search" className="btn btn-primary btn-large" id="new-search-btn">
              {t('search.checkAnotherClaim')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
