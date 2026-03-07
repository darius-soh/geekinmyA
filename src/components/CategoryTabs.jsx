// CategoryTabs component — horizontal scrollable filter tabs
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/moving-border';

export default function CategoryTabs({ categories = [], activeCategory, onSelect }) {
  const { t } = useLanguage();

  return (
    <div className="category-tabs" id="category-tabs">
      <Button
        className={`category-tab ${!activeCategory ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        {t('common.all')}
      </Button>
      {categories.map(cat => (
        <Button
          key={cat}
          className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
          onClick={() => onSelect(cat)}
          id={`tab-${cat}`}
        >
          {t(`categories.${cat}`)}
        </Button>
      ))}
    </div>
  );
}
