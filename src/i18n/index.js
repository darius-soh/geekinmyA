// i18n system for Sure Bo?
// Supports: English, Chinese, Malay, Tamil
import en from './en';
import zh from './zh';
import ms from './ms';
import ta from './ta';

const translations = { en, zh, ms, ta };

/**
 * Get a nested translation value by dot-separated key path
 * e.g., getTranslation('en', 'nav.home') returns 'Home'
 */
export function getTranslation(lang, keyPath) {
  const keys = keyPath.split('.');
  let value = translations[lang] || translations.en;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fallback to English
      let fallback = translations.en;
      for (const k of keys) {
        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = fallback[k];
        } else {
          return keyPath; // Return key path as last resort
        }
      }
      return fallback;
    }
  }

  return value;
}

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
];

export { translations };
export default translations;
