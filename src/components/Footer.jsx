// Footer component
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="footer" id="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <div className="footer-logo">
              Sure <span>Bo?</span>
            </div>
            <p className="footer-tagline">{t('footer.tagline')}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-disclaimer">{t('footer.disclaimer')}</p>
          <p className="footer-built">{t('footer.builtWith')}</p>
        </div>
      </div>
    </footer>
  );
}
