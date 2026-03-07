// Navbar component for Sure Bo?
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import { Button } from './ui/moving-border';

export default function Navbar() {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Track scroll for navbar shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { path: '/', label: t('nav.home'), id: 'nav-home' },
    { path: '/for-you', label: t('nav.forYou'), id: 'nav-for-you' },
    { path: '/guide', label: t('nav.guide'), id: 'nav-guide' },
    { path: '/search', label: t('nav.search'), id: 'nav-search' },
  ];
  const closeMenus = () => {
    setMobileOpen(false);
    setProfileOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} id="navbar">
        <div className="navbar-inner">
          {/* Logo */}
          <Link to="/" className="navbar-logo" id="logo">
            Sure <span>Bo?</span>
          </Link>

          {/* Center nav links */}
          <div className="navbar-center">
            {navLinks.map(link => (
              <Button
                as={Link}
                key={link.path}
                to={link.path}
                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                id={link.id}
                onClick={closeMenus}
              >
                {link.label}
              </Button>
            ))}
          </div>

          {/* Right side */}
          <div className="navbar-right">
            <LanguageSwitcher />

            {isAuthenticated && (
              <div className="language-switcher">
                <Button
                  className="nav-icon-btn"
                  onClick={() => setProfileOpen(!profileOpen)}
                  id="profile-btn"
                  aria-label="Profile"
                  borderRadius="9999px"
                  showArrow={false}
                >
                  {(user?.username?.[0] || 'U').toUpperCase()}
                </Button>
                {profileOpen && (
                  <div className="language-dropdown">
                    <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{user?.username}</div>
                    </div>
                    <Button
                      as={Link}
                      to="/settings"
                      className="language-option"
                      id="nav-settings"
                      onClick={closeMenus}
                    >
                      {t('nav.settings')}
                    </Button>
                    <Button
                      className="language-option"
                      onClick={() => { closeMenus(); logout(); navigate('/onboarding'); }}
                      id="nav-logout"
                    >
                      {t('nav.logout')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile toggle */}
            <Button
              className="navbar-mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              id="mobile-menu-toggle"
              aria-label="Menu"
              borderRadius="9999px"
              showArrow={false}
            >
              {mobileOpen ? 'X' : '≡'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`navbar-mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {navLinks.map(link => (
          <Button
            as={Link}
            key={link.path}
            to={link.path}
            className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            onClick={closeMenus}
          >
            {link.label}
          </Button>
        ))}
        {isAuthenticated && (
          <>
            <Button as={Link} to="/settings" className="nav-link" onClick={closeMenus}>{t('nav.settings')}</Button>
            <Button
              className="nav-link"
              onClick={() => { closeMenus(); logout(); navigate('/onboarding'); }}
              style={{ textAlign: 'left' }}
            >
              {t('nav.logout')}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
