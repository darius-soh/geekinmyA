import { useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import CredibleSourceSignalPanel from '../components/CredibleSourceSignalPanel';
import { Button } from '../components/ui/moving-border';
import {
  localizeCredibilityList,
  localizeCredibilityText,
} from '../utils/localizedCredibilityCopy';

function verdictTone(verdict) {
  if (verdict === 'supported' || verdict === 'likely_supported') return 'credible';
  if (verdict === 'likely_unsupported' || verdict === 'unsupported') return 'notCredible';
  return 'mixed';
}

function verdictLabel(verdict, t) {
  const key = `search.verdictLabels.${verdict}`;
  const translated = t(key);
  return translated === key ? verdict : translated;
}

function verdictSummary(verdict, inputType, t) {
  const baseKey = inputType === 'url_article'
    ? 'search.articleVerdictSummary'
    : 'search.claimVerdictSummary';
  const translated = t(`${baseKey}.${verdict}`);
  return translated === `${baseKey}.${verdict}`
    ? t(`search.claimVerdictSummary.${verdict}`)
    : translated;
}

function scoreTone(score) {
  if (score >= 70) return 'credible';
  if (score >= 40) return 'mixed';
  return 'notCredible';
}

function resolveLanguageLabel(languageCode, t) {
  const key = `languages.${languageCode}`;
  const translated = t(key);
  return translated === key ? (languageCode || 'en').toUpperCase() : translated;
}

function ScoreCard({ label, score, helper, toneOverride = '' }) {
  const tone = toneOverride || (score === null || score === undefined ? 'mixed' : scoreTone(score));

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-light)',
      padding: 'var(--space-5)',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-3)',
      }}>
        <span className={`credibility-meter-label ${tone}`} style={{ fontSize: 'var(--text-3xl)' }}>
          {score ?? '—'}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>/100</span>
      </div>
      {helper && (
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 'var(--leading-normal)',
        }}>
          {helper}
        </div>
      )}
    </div>
  );
}

export default function SearchResult() {
  const { t } = useLanguage();
  const location = useLocation();
  const result = location.state?.result;
  const source = location.state?.source || 'local';
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

  const inputType = result.inputType || 'plain_claim';
  const isUrl = inputType === 'url_article';
  const verdict = result.verdict || 'mixed';
  const verdictToneClass = verdictTone(verdict);
  const detectedLanguage = result.detectedLanguage || 'en';
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  const checkedClaims = Array.isArray(result.checkedClaims) ? result.checkedClaims : [];
  const limitations = localizeCredibilityList(
    Array.isArray(result.limitations) ? result.limitations : [],
    t
  );
  const explanation = localizeCredibilityText(result.explanation || '', t);
  const originalInput = result.originalInput || result.originalClaim || result.headline || '';
  const normalizedClaim = result.normalizedClaim || null;
  const confidence = result.confidence ?? result.confidenceScore ?? 0;
  const sourceCredibilityScore = result.sourceCredibilityScore;
  const claimSupportScore = result.claimSupportScore ?? result.score ?? 0;
  const verdictCopy = verdictSummary(verdict, inputType, t);

  return (
    <div className="page" id="search-result-page">
      <div className="container page-content">
        <div className="search-result-page animate-fade-in" style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Link to="/search" className="article-detail-back" id="back-to-search">
            {t('search.newSearch')}
          </Link>

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

          <div className="search-result-claim" id="result-claim">
            <div className="search-result-claim-label">
              {isUrl ? t('search.articleChecked') : t('search.claimChecked')}
            </div>
            <div className="search-result-claim-text">{originalInput}</div>
          </div>

          {normalizedClaim && normalizedClaim !== originalInput && (
            <div className="summary-card" style={{ marginBottom: 'var(--space-5)' }}>
              <h3 className="summary-card-title">{t('search.underlyingClaim')}</h3>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-normal)',
              }}>
                {normalizedClaim}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
            <div className="search-result-detected-lang">
              {t('search.detectedLanguage')}: <strong style={{ marginLeft: '4px' }}>{resolveLanguageLabel(detectedLanguage, t)}</strong>
            </div>
            <div className="search-result-detected-lang" style={{ background: 'var(--bg-secondary)' }}>
              {t('search.inputType')}: <strong style={{ marginLeft: '4px' }}>{t(`search.inputTypes.${inputType}`)}</strong>
            </div>
            <div className="search-result-detected-lang" style={{ background: `var(--${verdictToneClass === 'credible' ? 'credible' : verdictToneClass === 'notCredible' ? 'not-credible' : 'mixed'}-bg)`, color: `var(--${verdictToneClass === 'credible' ? 'credible' : verdictToneClass === 'notCredible' ? 'not-credible' : 'mixed'})` }}>
              {t('search.evidenceVerdict')}: <strong style={{ marginLeft: '4px' }}>{verdictLabel(verdict, t)}</strong>
            </div>
            {source === 'openai' && (
              <div className="search-result-detected-lang" style={{ background: 'var(--accent-primary-bg)', color: 'var(--accent-primary)' }}>
                {t('search.poweredByAI')}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-light)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-4)',
            }}>
              <div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-1)',
                }}>
                  {t('search.evidenceVerdict')}
                </div>
                <div className={`credibility-meter-label ${verdictToneClass}`} style={{ fontSize: 'var(--text-2xl)' }}>
                  {verdictLabel(verdict, t)}
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {t('article.confidence')}: <strong>{confidence}/100</strong>
              </div>
            </div>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-primary)',
              lineHeight: 'var(--leading-normal)',
              margin: 0,
            }}>
              {verdictCopy}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isUrl ? 'repeat(auto-fit, minmax(220px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            {isUrl && (
              <ScoreCard
                label={t('search.sourceCredibility')}
                score={sourceCredibilityScore}
                helper={result.sourceCredibilityExplanation || t('search.sourceCredibilityHelp')}
              />
            )}
            <ScoreCard
              label={t('search.claimSupport')}
              score={claimSupportScore}
              helper={isUrl ? t('search.claimSupportHelpArticle') : t('search.claimSupportHelp')}
            />
            <ScoreCard
              label={t('article.confidence')}
              score={confidence}
              helper={t('search.confidenceHelp')}
              toneOverride={scoreTone(confidence)}
            />
          </div>

          {result.credibleSourceSimilarity && isUrl && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <CredibleSourceSignalPanel signal={result.credibleSourceSimilarity} />
            </div>
          )}

          <div className="summary-card" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="summary-card-title">{t('search.whyWeThinkThis')}</h3>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--leading-normal)',
            }}>
              {explanation}
            </p>
          </div>

          {isUrl && checkedClaims.length > 0 && (
            <div className="summary-card" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 className="summary-card-title">{t('search.checkedClaims')}</h3>
              <div className="summary-list">
                {checkedClaims.map((claim, index) => (
                  <div key={`${claim.claim}-${index}`} className="summary-item">
                    <strong>{claim.claim}</strong> {' '}
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      ({claim.score}/100)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {t('search.sourcesChecked')}
            </h3>

            {evidence.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                {t('search.noEvidenceChecked')}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {evidence.map((item, index) => {
                  const tone = item.stance === 'supports'
                    ? 'credible'
                    : item.stance === 'contradicts'
                      ? 'notCredible'
                      : 'mixed';

                  return (
                    <a
                      key={`${item.url}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'var(--bg-primary)',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                        marginBottom: 'var(--space-2)',
                      }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.title || item.source}</strong>
                        <span className={`source-similarity-pill ${tone}`} style={{ alignSelf: 'flex-start' }}>
                          {t(`search.stanceLabels.${item.stance || 'context'}`)}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                        {item.source}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        lineHeight: 'var(--leading-normal)',
                      }}>
                        {item.snippet}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {limitations.length > 0 && (
            <div className="summary-card" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 className="summary-card-title">{t('search.analysisLimitations')}</h3>
              <div className="summary-list">
                {limitations.map((item, index) => (
                  <div key={index} className="summary-item">{item}</div>
                ))}
              </div>
            </div>
          )}

          <div className="recommendation-panel" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="recommendation-panel-title">{t('article.whatShouldYouDo')}</h3>
            <div className="recommendation-action">
              {localizeCredibilityText(result.recommendedNextStep || '', t)}
            </div>
          </div>

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
