/* eslint-disable react-refresh/only-export-components */
// Language context for Sure Bo?
// Provides language switching and translation function across the app
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useAuth } from './AuthContext';
import { getTranslation, supportedLanguages } from '../i18n';

const LanguageContext = createContext();
const STORAGE_KEY = 'surebo_language';
const DEFAULT_LANGUAGE = 'en';

function loadStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return resolveSupportedLanguage(window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE);
}

function resolveSupportedLanguage(language) {
  const fallback = DEFAULT_LANGUAGE;
  if (typeof language !== 'string') return fallback;

  const normalized = language.trim().toLowerCase();
  if (!normalized) return fallback;

  return supportedLanguages.some((item) => item.code === normalized)
    ? normalized
    : fallback;
}

export function LanguageProvider({ children }) {
  const { user } = useAuth();

  const [storedLanguage, setStoredLanguage] = useState(loadStoredLanguage);

  const language = useMemo(
    () => resolveSupportedLanguage(storedLanguage || user?.language || DEFAULT_LANGUAGE),
    [storedLanguage, user?.language]
  );

  const setLanguage = useCallback((lang) => {
    const nextLanguage = resolveSupportedLanguage(lang);
    setStoredLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((keyPath) => {
    return getTranslation(language, keyPath);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

export default LanguageContext;
