import { useContext } from 'react';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';

/**
 * Hook to access current authentication state, user profile, and session management.
 * In Guest Mode, `isGuest` is true and `user` is null.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
