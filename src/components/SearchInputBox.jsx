// SearchInputBox component — multi-mode input for URL/text
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/moving-border';

export default function SearchInputBox({ value, onChange, onSubmit, loading }) {
  const { t } = useLanguage();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="search-input-container" id="search-input-container">
      <div className="search-input-wrapper">
        <span className="search-icon">Search</span>
        <input
          type="text"
          className="search-input"
          placeholder={t('search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          id="search-input"
          autoComplete="off"
        />
        <Button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          id="search-submit-btn"
        >
          {loading ? t('search.checking') : t('search.checkButton')}
        </Button>
      </div>
    </div>
  );
}
