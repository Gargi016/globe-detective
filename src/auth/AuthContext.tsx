import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, isConfigured } from '../lib/firebase';
import type { UserProfileDoc } from '../types/database';
import { updateCloudProfile } from '../profile/userProfileService';
import { browserStorage } from '../detective/investigation';
import { migrateLocalStorageToCloud } from '../lib/migration';
import type { MigrationReport } from '../lib/migration';
import {
  fetchUserProfile,
  formatAuthError,
  sendResetPassword,
  signInUser,
  signOutUser,
  signUpUser,
} from './authService';
import type { SignUpParams } from './authService';

export type AuthModalView = 'signin' | 'signup' | 'reset';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfileDoc | null;
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  authModalOpen: boolean;
  authModalView: AuthModalView;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  refreshProfile: () => Promise<void>;
  updateProfileData: (updates: Partial<UserProfileDoc>) => Promise<boolean>;
  migrationNotice: MigrationReport | null;
  clearMigrationNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<AuthModalView>('signin');
  const [migrationNotice, setMigrationNotice] = useState<MigrationReport | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await fetchUserProfile(user.uid);
    setProfile(p);
  }, [user]);

  useEffect(() => {
    if (!auth || !isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const p = await fetchUserProfile(currentUser.uid);
          setProfile(p);

          // Perform non-destructive migration of LocalStorage data
          const report = await migrateLocalStorageToCloud(currentUser.uid, browserStorage());
          if (!report.skipped && (report.investigationsCount > 0 || report.achievementsCount > 0 || report.profileMigrated)) {
            setMigrationNotice(report);
            // Refresh profile after migration to capture merged stats
            const updatedProfile = await fetchUserProfile(currentUser.uid);
            if (updatedProfile) {
              setProfile(updatedProfile);
            }
          }
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
        setMigrationNotice(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = useCallback((view: AuthModalView = 'signin') => {
    setError(null);
    setAuthModalView(view);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearMigrationNotice = useCallback(() => setMigrationNotice(null), []);

  const signIn = useCallback(async (email: string, pass: string) => {
    setError(null);
    try {
      await signInUser(email, pass);
      setAuthModalOpen(false);
    } catch (err) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signUp = useCallback(async (params: SignUpParams) => {
    setError(null);
    try {
      await signUpUser(params);
      setAuthModalOpen(false);
    } catch (err) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await signOutUser();
      setUser(null);
      setProfile(null);
      setMigrationNotice(null);
    } catch (err) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendResetPassword(email);
    } catch (err) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const updateProfileData = useCallback(
    async (updates: Partial<UserProfileDoc>): Promise<boolean> => {
      if (!user) return false;
      const ok = await updateCloudProfile(user.uid, updates);
      if (ok) {
        setProfile((prev) => (prev ? { ...prev, ...updates, updatedAt: Date.now() } : null));
      }
      return ok;
    },
    [user],
  );

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    error,
    isGuest: !user,
    isConfigured,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError,
    authModalOpen,
    authModalView,
    openAuthModal,
    closeAuthModal,
    refreshProfile,
    updateProfileData,
    migrationNotice,
    clearMigrationNotice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
