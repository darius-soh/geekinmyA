import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ForYouSectionList from '../components/ForYouSectionList';

export default function ForYou() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const savedInterests = Array.isArray(user?.interests) ? user.interests : [];

  return (
    <div className="page" id="for-you-page">
      <div className="container page-content">
        <div className="animate-fade-in">
          <section className="section">
            <div className="section-header">
              <div>
                <h1 className="section-title">{t('forYou.title')}</h1>
                <p className="section-subtitle">{t('forYou.subtitle')}</p>
              </div>
            </div>

            <ForYouSectionList
              interests={savedInterests}
              limitPerInterest={6}
              showEmptyState
            />
          </section>
        </div>
      </div>
    </div>
  );
}
