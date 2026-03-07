// Settings page — manage user preferences
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supportedLanguages } from '../i18n';
import { Button } from '../components/ui/moving-border';

const ALL_INTERESTS = [
  'world', 'singapore', 'business', 'technology',
  'science', 'health', 'sports', 'entertainment',
  'lifestyle', 'environment', 'politics',
];

export default function Settings() {
  const { user, updatePreferences, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: user?.username || '',
    language: language,
    interests: user?.interests || [],
  });
  const [saved, setSaved] = useState(false);

  const toggleInterest = (interest) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    updatePreferences({
      username: form.username,
      interests: form.interests,
      language: form.language,
    });
    setLanguage(form.language);
    setSaved(true);
    navigate('/', {
      replace: true,
      state: { settingsSaved: true },
    });
  };

  const handleDelete = () => {
    if (window.confirm(t('settings.confirmDeleteAccount'))) {
      logout();
      navigate('/onboarding');
    }
  };

  return (
    <div className="page" id="settings-page">
      <div className="container page-content">
        <div className="settings-page animate-fade-in">
          <div className="settings-header">
            <h1>{t('settings.title')}</h1>
            <p>{t('settings.subtitle')}</p>
          </div>

          {/* Profile Section */}
          <div className="settings-section">
            <h2>{t('nav.profile')}</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-username">{t('settings.displayName')}</label>
              <input
                id="settings-username"
                type="text"
                className="form-input"
                value={form.username}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, username: e.target.value }));
                  setSaved(false);
                }}
              />
            </div>
          </div>

          {/* Language Section */}
          <div className="settings-section">
            <h2>{t('settings.language')}</h2>
            <div className="form-group">
              <select
                className="form-select"
                value={form.language}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, language: e.target.value }));
                  setSaved(false);
                }}
                id="settings-language"
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interests Section */}
          <div className="settings-section">
            <h2>{t('settings.interests')}</h2>
            <div className="form-checkbox-group">
              {ALL_INTERESTS.map(interest => (
                <label
                  key={interest}
                  className={`form-checkbox-label ${form.interests.includes(interest) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form.interests.includes(interest)}
                    onChange={() => toggleInterest(interest)}
                  />
                  {t(`categories.${interest}`)}
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            <Button className="btn btn-primary btn-large" onClick={handleSave} id="save-settings">
              {t('settings.save')}
            </Button>
            {saved && (
              <span className="settings-saved">{t('settings.saved')}</span>
            )}
          </div>

          {/* Danger Zone */}
          <div className="settings-section settings-danger">
            <h2>{t('settings.dangerZone')}</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              {t('settings.deleteWarning')}
            </p>
            <Button
              className="btn btn-secondary"
              onClick={handleDelete}
              id="delete-account-btn"
              style={{
                '--moving-border-text': 'var(--not-credible)',
                '--moving-border-bg': 'var(--bg-card)',
                '--moving-border-hover-text': 'white',
                '--moving-border-accent': 'var(--not-credible)',
                '--moving-border-border-color': 'rgba(196, 81, 61, 0.35)',
              }}
            >
              {t('settings.deleteAccount')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
