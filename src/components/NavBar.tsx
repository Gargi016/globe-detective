import { ROUTES } from '../hooks/useHashRoute';
import type { Route } from '../hooks/useHashRoute';
import { useAuth } from '../hooks/useAuth';

export interface NavBarProps {
  current: Route | null;
}

function CompassMark() {
  return (
    <svg className="nav__mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
      <path d="M16 2 L18.2 16 L16 30 L13.8 16 Z" fill="currentColor" opacity="0.9" />
      <path d="M2 16 L16 13.8 L30 16 L16 18.2 Z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export default function NavBar({ current }: NavBarProps) {
  const { user, profile, isGuest, openAuthModal, signOut } = useAuth();
  const name = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Detective';

  return (
    <header className="nav">
      <a className="nav__brand" href="#/" aria-label="Globe Detective, home">
        <CompassMark />
        <span className="nav__brand-text">
          Globe <em>Detective</em>
        </span>
      </a>
      <nav className="nav__links" aria-label="Primary">
        {ROUTES.map(({ route, hash, label, modeSuffix }) => (
          <a
            key={route}
            href={hash}
            className="nav__link"
            aria-current={route === current ? 'page' : undefined}
          >
            {label}
            {modeSuffix && <span className="nav__suffix">{modeSuffix}</span>}
          </a>
        ))}
      </nav>
      <div className="nav__auth">
        {isGuest ? (
          <button
            type="button"
            className="btn btn--small btn--ghost nav__auth-btn"
            onClick={() => openAuthModal('signin')}
            aria-label="Sign in"
          >
            Sign in
          </button>
        ) : (
          <div className="nav__user">
            <a href="#/profile" className="nav__user-link" title="View profile">
              <span className="nav__user-name">{name}</span>
            </a>
            <button
              type="button"
              className="nav__user-signout"
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
