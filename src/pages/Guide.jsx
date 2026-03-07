import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/moving-border';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function Guide() {
  const { t } = useLanguage();
  const sections = asArray(t('guide.sections'));
  const checklist = asArray(t('guide.checklist'));

  return (
    <div className="page" id="guide-page">
      <div className="container page-content">
        <div className="guide-page animate-fade-in">
          <section className="guide-hero">
            <div className="guide-hero-copy">
              <span className="guide-pill">{t('guide.introLabel')}</span>
              <h1 className="section-title">{t('guide.title')}</h1>
              <p className="section-subtitle guide-subtitle">{t('guide.subtitle')}</p>
            </div>

            <div className="guide-hero-panel">
              <h2 className="guide-panel-title">{t('guide.introTitle')}</h2>
              <p className="guide-panel-body">{t('guide.introBody')}</p>
            </div>
          </section>

          <section className="guide-grid-section">
            <div className="guide-grid">
              {sections.map((section, index) => (
                <article key={section.title || index} className={`guide-card stagger-${Math.min(index + 1, 6)}`}>
                  <h2 className="guide-card-title">{section.title}</h2>
                  <p className="guide-card-body">{section.body}</p>
                  {asArray(section.bullets).length > 0 && (
                    <ul className="guide-card-list">
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li key={`${section.title}-${bulletIndex}`}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="guide-checklist-section">
            <div className="guide-checklist-card">
              <h2 className="guide-panel-title">{t('guide.checklistTitle')}</h2>
              <ul className="guide-checklist-list">
                {checklist.map((item, index) => (
                  <li key={`checklist-${index}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="guide-footer-card">
              <h2 className="guide-panel-title">{t('guide.footerTitle')}</h2>
              <p className="guide-panel-body">{t('guide.footerBody')}</p>
              <Button
                as={Link}
                to="/search"
                className="btn btn-primary"
                style={{ marginTop: 'var(--space-5)' }}
              >
                {t('guide.cta')}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
