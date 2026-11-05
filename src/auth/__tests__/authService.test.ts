import { describe, expect, it } from 'vitest';
import {
  cleanUsername,
  fetchUserProfile,
  formatAuthError,
  sendResetPassword,
  signInUser,
  signOutUser,
  signUpUser,
} from '../authService';

describe('authService helper functions', () => {
  describe('cleanUsername', () => {
    it('lowercases and strips invalid characters', () => {
      expect(cleanUsername('Detective_007!')).toBe('detective_007');
      expect(cleanUsername('Jane Doe')).toBe('janedoe');
      expect(cleanUsername('Atlas-Hunter#123')).toBe('atlas-hunter123');
    });

    it('truncates to 20 characters', () => {
      const longName = 'supercalifragilisticexpialidocious';
      expect(cleanUsername(longName)).toHaveLength(20);
      expect(cleanUsername(longName)).toBe('supercalifragilistic');
    });

    it('handles empty strings gracefully', () => {
      expect(cleanUsername('')).toBe('');
    });
  });

  describe('formatAuthError', () => {
    it('formats known Firebase auth codes cleanly', () => {
      expect(formatAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already exists/i);
      expect(formatAuthError({ code: 'auth/invalid-email' })).toMatch(/valid email/i);
      expect(formatAuthError({ code: 'auth/wrong-password' })).toMatch(/incorrect email or password/i);
      expect(formatAuthError({ code: 'auth/invalid-credential' })).toMatch(/incorrect email or password/i);
      expect(formatAuthError({ code: 'auth/user-not-found' })).toMatch(/incorrect email or password/i);
      expect(formatAuthError({ code: 'auth/weak-password' })).toMatch(/at least 6 characters/i);
      expect(formatAuthError({ code: 'auth/too-many-requests' })).toMatch(/too many unsuccessful attempts/i);
      expect(formatAuthError({ code: 'auth/network-request-failed' })).toMatch(/network error/i);
      expect(formatAuthError({ code: 'auth/popup-closed-by-user' })).toMatch(/cancelled/i);
    });

    it('falls back to message or generic description for unknown errors', () => {
      expect(formatAuthError({ message: 'Custom server error' })).toBe('Custom server error');
      expect(formatAuthError(null)).toMatch(/unexpected error/i);
      expect(formatAuthError(undefined)).toMatch(/unexpected error/i);
      expect(formatAuthError({})).toMatch(/unexpected error|authentication failed/i);
    });
  });

  describe('unconfigured fallback behavior', () => {
    it('throws friendly error when attempting auth operations without config', async () => {
      // In default test environment without VITE_FIREBASE_API_KEY, isConfigured is false
      await expect(
        signUpUser({
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Tester',
          username: 'tester',
        })
      ).rejects.toThrow(/not configured/i);

      await expect(signInUser('test@example.com', 'password123')).rejects.toThrow(/not configured/i);

      await expect(sendResetPassword('test@example.com')).rejects.toThrow(/not configured/i);
    });

    it('gracefully handles signOut and fetchUserProfile when unconfigured', async () => {
      await expect(signOutUser()).resolves.toBeUndefined();
      const profile = await fetchUserProfile('some-uid');
      expect(profile).toBeNull();
    });
  });
});
