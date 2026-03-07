// Language Switcher component
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supportedLanguages } from '../i18n';
import { Button } from './ui/moving-border';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const { isAuthenticated, updatePreferences } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="language-switcher" ref={ref}>
      <Button
        className="language-switcher-btn"
        onClick={() => setOpen(!open)}
        id="language-switcher-btn"
        aria-label="Switch language"
      >
        <span>{currentLang.nativeName}</span>
      </Button>

      {open && (
        <div className="language-dropdown" id="language-dropdown">
          {supportedLanguages.map(lang => (
            <Button
              key={lang.code}
              className={`language-option ${language === lang.code ? 'active' : ''}`}
              onClick={() => {
                setLanguage(lang.code);
                if (isAuthenticated) {
                  updatePreferences({ language: lang.code });
                }
                setOpen(false);
              }}
              id={`lang-${lang.code}`}
            >
              <span style={{ fontWeight: 500 }}>{lang.nativeName}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {lang.name}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
