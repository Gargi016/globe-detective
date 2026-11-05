import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NavBar from './components/NavBar';
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const DetectivePage = lazy(() => import('./pages/DetectivePage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
import AchievementToasts from './components/profile/AchievementToasts';
import MigrationToast from './components/auth/MigrationToast';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider } from './auth/AuthContext';
import AuthModal from './components/auth/AuthModal';
import { useHashRoute } from './hooks/useHashRoute';
import type { ResolvedRoute } from './hooks/useHashRoute';
import { countryKey } from './lib/countries';
import type { CountryFeature } from './types/geo';

const TITLES: Record<ResolvedRoute, string> = {
  notfound: 'Page not found · Globe Detective',
  home: 'Globe Detective',
  timeline: 'Timeline · Globe Detective',
  detective: 'Detective Mode · Globe Detective',
  challenge: 'Challenge Mode · Globe Detective',
  leaderboard: 'Leaderboard · Globe Detective',
  profile: 'Profile · Globe Detective',
  about: 'About · Globe Detective',
};

function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading__ring" aria-hidden="true" />
      <p>Loading…</p>
    </div>
  );
}

function AppContent() {
  const route = useHashRoute();
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(
    () => (selectedKey ? (countries.find((c) => countryKey(c) === selectedKey) ?? null) : null),
    [countries, selectedKey],
  );

  const handleSelect = useCallback((country: CountryFeature) => {
    setSelectedKey(countryKey(country));
  }, []);
  const handleClear = useCallback(() => setSelectedKey(null), []);

  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    document.title = TITLES[route];
    // After a navigation, move keyboard and screen-reader focus to the new page and announce it.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setAnnounce(`${TITLES[route].split(' · ')[0]} page`);
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  // Escape clears the current selection (on the globe page).
  useEffect(() => {
    if (route !== 'home') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route]);

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <NavBar current={route === 'notfound' ? null : route} />

      <main id="main" ref={mainRef} tabIndex={-1} className={`app__main app__main--${route}`}>
        <ErrorBoundary resetKey={route}>
          <Suspense fallback={<PageLoading />}>
            {route === 'home' && (
              <HomePage
                countries={countries}
                selected={selected}
                selectedKey={selectedKey}
                onSelect={handleSelect}
                onClear={handleClear}
                onCountriesLoaded={setCountries}
              />
            )}
            {route === 'timeline' && <HistoryPage />}
            {route === 'detective' && <DetectivePage />}
            {route === 'challenge' && <ChallengePage />}
            {route === 'leaderboard' && <LeaderboardPage />}
            {route === 'profile' && <ProfilePage />}
            {route === 'about' && <AboutPage />}
            {route === 'notfound' && <NotFoundPage />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <AchievementToasts />
      <MigrationToast />
      <AuthModal />
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <footer className="app__footer">
        <span>
          {route === 'timeline' ||
          route === 'detective' ||
          route === 'challenge' ||
          route === 'profile' ||
          route === 'leaderboard'
            ? 'Historical borders: CShapes 2.0 · Schvitz et al. 2022 · CC BY-NC-SA 4.0 (non-commercial)'
            : 'Modern borders shown for reference · Natural Earth via world-atlas'}
          {' · '}
          <a href="#/about">Data sources and licences</a>
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
