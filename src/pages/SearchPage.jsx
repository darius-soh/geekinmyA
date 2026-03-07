// Search Page — GPT-like claim checking interface
// Redesigned as a ChatGPT-style search experience
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { analyzeWithOpenAI } from '../api/openaiService';
import { analyzeUserClaim } from '../api/credibilityEngine';
import UploadDropzone from '../components/UploadDropzone';
import { Button } from '../components/ui/moving-border';

// Detect if text looks like a URL
function isUrl(text) {
  return /^https?:\/\//.test(text.trim()) || /^www\./.test(text.trim());
}

export default function SearchPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = async () => {
    if (!query.trim() && !file) return;

    setLoading(true);
    setError('');
    const userInput = query.trim();
    const url = isUrl(userInput) ? (userInput.startsWith('http') ? userInput : `https://${userInput}`) : undefined;

    try {
      // Try OpenAI first
      setLoadingStage(t('search.connectingToAI'));
      
      try {
        if (url) setLoadingStage(t('search.fetchingArticleContent'));
        await new Promise(r => setTimeout(r, 300)); // Brief visual feedback

        setLoadingStage(t('search.checking'));
        const result = await analyzeWithOpenAI({
          text: userInput,
          url,
          language,
          fileName: file?.name,
        });

        // Navigate to result page with OpenAI result
        navigate('/search/result', { state: { result, source: 'openai' } });
        return;
      } catch (aiErr) {
        console.warn('OpenAI analysis failed, falling back to local engine:', aiErr.message);
        
        // Fall back to local mock engine
        setLoadingStage(t('search.localAnalysis'));
        const result = await analyzeUserClaim({
          text: userInput,
          url,
          fileName: file?.name,
          language,
        });

        navigate('/search/result', { state: { result, source: 'local', aiError: aiErr.message } });
      }
    } catch (err) {
      console.error('All analysis failed:', err);
      setError(err.message || t('search.analysisFailed'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading && query.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Example prompts for user guidance
  const examplePrompts = t('search.examplePrompts');

  return (
    <div className="page" id="search-page">
      <div className="search-page" style={{ justifyContent: loading ? 'flex-start' : 'center', paddingTop: loading ? 'calc(var(--nav-height) + var(--space-10))' : undefined }}>

        {/* Header */}
        {!loading && (
          <div className="search-page-header animate-fade-in-up">
            <h1 className="search-page-title">{t('search.title')}</h1>
            <p className="search-page-subtitle">
              {t('search.subtitle')}
            </p>
          </div>
        )}

        {/* Main input area */}
        <div className="search-page-main animate-fade-in-up stagger-2" style={{ maxWidth: '720px' }}>
          {/* GPT-like input box */}
          <div
            className="gpt-input-container"
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-4)',
              transition: 'all var(--transition-base)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <textarea
              ref={inputRef}
              className="gpt-input"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              id="search-input"
              rows={1}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 'var(--text-lg)',
                fontFamily: 'var(--font-sans)',
                background: 'transparent',
                color: 'var(--text-primary)',
                padding: 'var(--space-2)',
                minHeight: '48px',
                maxHeight: '200px',
                lineHeight: '1.5',
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
            />

            {/* Action row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'var(--space-2)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--border-light)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  className="btn btn-secondary"
                  onClick={() => setShowUpload(!showUpload)}
                  title={t('search.uploadButton')}
                  contentStyle={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                >
                  {t('search.uploadButton')}
                </Button>
              </div>

              <Button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || (!query.trim() && !file)}
                id="search-submit-btn"
                borderRadius="9999px"
                contentStyle={{ padding: 'var(--space-2) var(--space-5)' }}
              >
                {loading ? (
                  <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                ) : (
                  t('search.checkButton')
                )}
              </Button>
            </div>
          </div>

          {/* File upload area */}
          {showUpload && !loading && (
            <div className="animate-fade-in" style={{ marginTop: 'var(--space-3)' }}>
              <UploadDropzone onFileSelect={setFile} file={file} />
            </div>
          )}

          {/* File preview */}
          {file && !showUpload && (
            <div className="uploaded-file" style={{ marginTop: 'var(--space-3)' }}>
              <span>{t('common.file')}</span>
              <span>{file.name}</span>
              <Button
                className="uploaded-file-remove-button"
                onClick={() => setFile(null)}
                aria-label={t('common.remove')}
                borderRadius="9999px"
                contentStyle={{ width: '28px', height: '28px', padding: 0 }}
                showArrow={false}
              >
                X
              </Button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="animate-fade-in" style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--not-credible-bg)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--not-credible)',
              fontSize: 'var(--text-sm)',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Loading state — analysis in progress */}
        {loading && (
          <div className="animate-fade-in-up" style={{
            marginTop: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}>
            <div style={{
              width: '100%',
              maxWidth: '720px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-8)',
              border: '1px solid var(--border-light)',
            }}>
              {/* User's query */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 'var(--text-sm)',
                }}>
                  {t('common.you')}
                </div>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  paddingTop: 'var(--space-1)',
                  wordBreak: 'break-word',
                }}>
                  {query}
                </div>
              </div>

              {/* AI thinking indicator */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 'var(--text-sm)',
                }}>
                  {t('common.ai')}
                </div>
                <div style={{ paddingTop: 'var(--space-1)' }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    {t('search.aiAnalyzing')}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-tertiary)',
                  }}>
                    {loadingStage || t('search.processingRequest')}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: 'var(--space-1)',
                    marginTop: 'var(--space-3)',
                  }}>
                    <span className="typing-dot" style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--accent-primary)', animation: 'pulse 1.5s infinite',
                    }} />
                    <span className="typing-dot" style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--accent-primary)', animation: 'pulse 1.5s infinite 0.3s',
                    }} />
                    <span className="typing-dot" style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--accent-primary)', animation: 'pulse 1.5s infinite 0.6s',
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Example prompts — shown when idle */}
        {!loading && (
          <div className="animate-fade-in-up stagger-3" style={{
            marginTop: 'var(--space-8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-3)',
            maxWidth: '720px',
            width: '100%',
          }}>
            {examplePrompts.map((prompt, i) => (
              <Button
                key={i}
                className="search-example-button"
                onClick={() => {
                  if (i === 0) {
                    inputRef.current?.focus();
                  } else {
                    setQuery(prompt.replace(/^"/, '').replace(/"$/, ''));
                    inputRef.current?.focus();
                  }
                }}
                contentStyle={{ textAlign: 'left' }}
              >
                <span>{prompt}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
