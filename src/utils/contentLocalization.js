function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getNestedTranslation(item, language, field) {
  return safeText(item?.translations?.[language]?.[field]);
}

export function getLocalizedField(item, field, language = 'en') {
  if (!item || typeof item !== 'object') return '';

  const languageCode = safeText(language) || 'en';
  const localizedKey = `${field}_${languageCode}`;
  const englishKey = `${field}_en`;
  const localizedNestedValue = getNestedTranslation(item, languageCode, field);
  const englishNestedValue = getNestedTranslation(item, 'en', field);
  const localizedValue = safeText(item[localizedKey]);
  const englishValue = safeText(item[englishKey]);
  const baseValue = safeText(item[field]);

  if (localizedNestedValue) return localizedNestedValue;
  if (localizedValue) return localizedValue;
  if (englishNestedValue) return englishNestedValue;
  if (englishValue) return englishValue;
  return baseValue;
}

function hasLanguageSpecificCopy(item, field, language = 'en') {
  if (!item || typeof item !== 'object') return false;
  const localizedKey = `${field}_${language}`;
  const localizedNestedValue = getNestedTranslation(item, language, field);
  const localizedValue = safeText(item[localizedKey]);
  const baseValue = safeText(item[field]);
  return Boolean(
    (localizedNestedValue && localizedNestedValue !== baseValue)
    || (localizedValue && localizedValue !== baseValue)
  );
}

export function getLocalizedArticleCopy(article, language = 'en') {
  return {
    title: getLocalizedField(article, 'title', language),
    shortDescription: getLocalizedField(article, 'shortDescription', language),
    description: getLocalizedField(article, 'description', language),
    content: getLocalizedField(article, 'content', language),
    summary: getLocalizedField(article, 'summary', language),
  };
}

export function articleUsesOriginalLanguage(article, language = 'en') {
  if (!article || typeof article !== 'object') return true;
  const languageCode = safeText(language) || 'en';
  const originalLanguage = getArticleOriginalLanguage(article);
  if (languageCode === originalLanguage) return false;

  return !(
    hasLanguageSpecificCopy(article, 'title', languageCode)
    || hasLanguageSpecificCopy(article, 'shortDescription', languageCode)
    || hasLanguageSpecificCopy(article, 'description', languageCode)
    || hasLanguageSpecificCopy(article, 'summary', languageCode)
    || hasLanguageSpecificCopy(article, 'content', languageCode)
  );
}

export function getArticleOriginalLanguage(article) {
  const value = safeText(article?.originalLanguage || article?.language);
  return value || 'en';
}
