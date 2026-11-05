import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isConfigured } from '../lib/firebase';
import type { UserProfileDoc } from '../types/database';

/**
 * Translates Firebase Auth error codes into clear, polite messages.
 */
export function formatAuthError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'An unexpected error occurred. Please try again.';
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const message = 'message' in err ? String((err as { message: unknown }).message) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please check your credentials.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a moment before trying again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    default:
      return message || 'Authentication failed. Please try again.';
  }
}

/** Sanitize an entered username to valid letters, numbers, underscores and hyphens. */
export function cleanUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 20);
}

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  username: string;
}

/** Signs up a new user, updates their auth profile, and creates their initial Firestore profile doc. */
export async function signUpUser({ email, password, displayName, username }: SignUpParams): Promise<UserCredential> {
  if (!auth || !isConfigured) {
    throw new Error('Firebase is not configured. Guest Mode is active.');
  }

  const cleanName = displayName.trim() || 'Anonymous Detective';
  const cleanUser = cleanUsername(username) || `detective_${Date.now().toString(36)}`;

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: cleanName });

  if (db) {
    const userDocRef = doc(db, 'users', cred.user.uid);
    const newProfile: UserProfileDoc = {
      uid: cred.user.uid,
      email: cred.user.email ?? email.trim(),
      username: cleanUser,
      displayName: cleanName,
      emblem: 'compass',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalPoints: 0,
        challengesPlayed: 0,
        bestStreak: 0,
        currentStreak: 0,
        investigationsCount: 0,
        badgesCount: 0,
      },
      exploredYears: [],
    };
    await setDoc(userDocRef, newProfile, { merge: true });
  }

  return cred;
}

/** Signs in an existing user with email and password. */
export async function signInUser(email: string, password: string): Promise<UserCredential> {
  if (!auth || !isConfigured) {
    throw new Error('Firebase is not configured. Guest Mode is active.');
  }
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/** Signs out the current user. */
export async function signOutUser(): Promise<void> {
  if (!auth || !isConfigured) return;
  await firebaseSignOut(auth);
}

/** Sends a password reset email. */
export async function sendResetPassword(email: string): Promise<void> {
  if (!auth || !isConfigured) {
    throw new Error('Firebase is not configured. Guest Mode is active.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/** Fetches the user profile document from Firestore. */
export async function fetchUserProfile(uid: string): Promise<UserProfileDoc | null> {
  if (!db || !isConfigured) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch user profile from Firestore:', err);
    return null;
  }
}
