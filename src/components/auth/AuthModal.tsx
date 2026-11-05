import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function AuthModal() {
  const {
    authModalOpen,
    authModalView,
    closeAuthModal,
    openAuthModal,
    signIn,
    signUp,
    resetPassword,
    error,
    clearError,
    isConfigured,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus trap / auto-focus on open
  useEffect(() => {
    if (authModalOpen) {
      clearError();
      setResetSent(false);
      window.setTimeout(() => emailInputRef.current?.focus(), 50);
    }
  }, [authModalOpen, authModalView, clearError]);

  // Escape key listener to close modal
  useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResetSent(false);

    try {
      if (authModalView === 'signin') {
        await signIn(email, password);
      } else if (authModalView === 'signup') {
        await signUp({ email, password, displayName, username });
      } else if (authModalView === 'reset') {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch {
      // Error handled by AuthContext state
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    authModalView === 'signin'
      ? 'Sign in to Globe Detective'
      : authModalView === 'signup'
        ? 'Create your Detective Account'
        : 'Reset your password';

  return (
    <div className="auth-backdrop" onClick={closeAuthModal} role="presentation">
      <div
        className="auth-modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal__close"
          onClick={closeAuthModal}
          aria-label="Close dialog"
        >
          ✕
        </button>

        <p className="eyebrow">Cloud Synchronization</p>
        <h2 id="auth-title" className="auth-modal__title">
          {title}
        </h2>

        {!isConfigured && (
          <div className="notice notice--warn" role="alert">
            Firebase credentials are not configured in this environment. The app is running in <strong>Guest Mode</strong>.
          </div>
        )}

        {error && (
          <div className="notice notice--bad" role="alert">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="notice notice--ok" role="status">
            Password reset link sent to <strong>{email}</strong>. Check your inbox.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {authModalView === 'signup' && (
            <>
              <div className="field">
                <label htmlFor="auth-display-name">Display Name</label>
                <input
                  id="auth-display-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Inspector Holmes"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                />
              </div>

              <div className="field">
                <label htmlFor="auth-username">Detective Codename (@username)</label>
                <input
                  id="auth-username"
                  type="text"
                  className="input"
                  placeholder="e.g. sherlock"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  maxLength={20}
                  required
                />
                <span className="field__hint">Letters, numbers, underscores and hyphens.</span>
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              ref={emailInputRef}
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {authModalView !== 'reset' && (
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          <div className="auth-form__actions">
            <button
              type="submit"
              className="btn btn--primary auth-form__submit"
              disabled={submitting || !isConfigured}
            >
              {submitting
                ? 'Processing…'
                : authModalView === 'signin'
                  ? 'Sign In'
                  : authModalView === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
            </button>
          </div>
        </form>

        <div className="auth-modal__footer">
          {authModalView === 'signin' && (
            <div className="auth-modal__links">
              <span>
                New detective?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => openAuthModal('signup')}
                >
                  Create an account
                </button>
              </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => openAuthModal('reset')}
              >
                Forgot your password?
              </button>
            </div>
          )}

          {authModalView === 'signup' && (
            <div className="auth-modal__links">
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => openAuthModal('signin')}
                >
                  Sign in here
                </button>
              </span>
            </div>
          )}

          {authModalView === 'reset' && (
            <div className="auth-modal__links">
              <button
                type="button"
                className="link-btn"
                onClick={() => openAuthModal('signin')}
              >
                Back to Sign In
              </button>
            </div>
          )}

          <p className="auth-modal__guest-note">
            Or continue exploring as a guest without an account. All personal case files and badges remain stored in this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
