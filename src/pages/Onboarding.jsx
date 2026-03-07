// Onboarding page — multi-step profile setup
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

export default function Onboarding() {
  const { login } = useAuth();
  const { t, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    username: '',
    password: '',
    age: '',
    language: 'en',
    interests: ['singapore'],
    acceptTerms: false,
  });

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const toggleInterest = (interest) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
    setErrors(prev => ({ ...prev, interests: '' }));
  };

  const validateStep = () => {
    const newErrors = {};

    if (step === 0) {
      if (!form.username.trim()) newErrors.username = t('onboarding.required');
      if (!form.password) newErrors.password = t('onboarding.required');
      else if (form.password.length < 6) newErrors.password = t('onboarding.passwordLength');
    }

    if (step === 1) {
      if (!form.age) newErrors.age = t('onboarding.required');
      else if (isNaN(form.age) || form.age < 1 || form.age > 120) newErrors.age = t('onboarding.invalidAge');
    }

    if (step === 2) {
      if (form.interests.length === 0) newErrors.interests = t('onboarding.selectAtLeastOne');
    }

    if (step === 3) {
      if (!form.acceptTerms) newErrors.acceptTerms = t('onboarding.acceptTerms');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (step === 1) {
      // Apply language selection immediately
      setLanguage(form.language);
    }

    if (step === 3) {
      // Final step — create account
      login({
        username: form.username,
        age: parseInt(form.age),
        language: form.language,
        interests: form.interests,
      });
      navigate('/');
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const stepTitles = [
    t('onboarding.step1Title'),
    t('onboarding.step2Title'),
    t('onboarding.step3Title'),
    t('onboarding.step4Title'),
  ];

  return (
    <div className="onboarding-page" id="onboarding-page">
      {/* Background decorative shapes */}
      <div className="onboarding-bg-shape" />
      <div className="onboarding-bg-shape" />
      <div className="onboarding-bg-shape" />

      <div className="onboarding-card">
        {/* Header — shown only on first step */}
        {step === 0 && (
          <div className="onboarding-header animate-fade-in">
            <div className="onboarding-logo">
              Sure <span>Bo?</span>
            </div>
            <p className="onboarding-subtitle">{t('onboarding.subtitle')}</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
              {t('onboarding.getStarted')}
            </p>
          </div>
        )}

        {/* Progress dots */}
        <div className="onboarding-progress">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`onboarding-progress-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Step title */}
        <h2 className="onboarding-step-title animate-fade-in" key={step}>
          {stepTitles[step]}
        </h2>

        {/* Step 0: Account */}
        {step === 0 && (
          <div className="animate-fade-in-up">
            <div className="form-group">
              <label className="form-label" htmlFor="onboard-username">{t('onboarding.username')}</label>
              <input
                id="onboard-username"
                type="text"
                className={`form-input ${errors.username ? 'error' : ''}`}
                placeholder={t('onboarding.usernamePlaceholder')}
                value={form.username}
                onChange={(e) => updateForm('username', e.target.value)}
                autoFocus
              />
              {errors.username && <p className="form-error">{errors.username}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="onboard-password">{t('onboarding.password')}</label>
              <input
                id="onboard-password"
                type="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder={t('onboarding.passwordPlaceholder')}
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
              />
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>
          </div>
        )}

        {/* Step 1: About You */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="form-group">
              <label className="form-label" htmlFor="onboard-age">{t('onboarding.age')}</label>
              <input
                id="onboard-age"
                type="number"
                className={`form-input ${errors.age ? 'error' : ''}`}
                placeholder={t('onboarding.agePlaceholder')}
                value={form.age}
                onChange={(e) => updateForm('age', e.target.value)}
                min="1"
                max="120"
                autoFocus
              />
              {errors.age && <p className="form-error">{errors.age}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="onboard-language">{t('onboarding.preferredLanguage')}</label>
              <select
                id="onboard-language"
                className="form-select"
                value={form.language}
                onChange={(e) => updateForm('language', e.target.value)}
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              {t('onboarding.selectInterests')}
            </p>
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
            {errors.interests && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.interests}</p>}
          </div>
        )}

        {/* Step 3: Terms */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <div className="terms-text">
              {t('onboarding.termsText')}
            </div>
            <label
              className={`form-checkbox-label ${form.acceptTerms ? 'checked' : ''}`}
              style={{ marginTop: 'var(--space-4)' }}
            >
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => updateForm('acceptTerms', e.target.checked)}
                id="accept-terms"
              />
              {t('onboarding.termsLabel')}
            </label>
            {errors.acceptTerms && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.acceptTerms}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="onboarding-actions">
          {step > 0 && (
            <Button className="btn btn-secondary" onClick={handleBack} id="onboard-back">
              {t('onboarding.back')}
            </Button>
          )}
          <Button className="btn btn-primary btn-full" onClick={handleNext} id="onboard-next">
            {step === 3 ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
