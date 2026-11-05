import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isConfigured } from '../lib/firebase';
import type { UserProfileDoc } from '../types/database';
import type { ProgressState } from '../challenge/progress';
import type { ProfileData, EmblemId } from './profileStore';
import { cleanUsername } from '../auth/authService';

/** Compiles aggregated user statistics from local progress and profile data. */
export function buildUserStats(progress: ProgressState, profile: ProfileData): UserProfileDoc['stats'] {
  return {
    totalPoints: progress.stats.totalPoints,
    challengesPlayed: progress.stats.played,
    bestStreak: progress.stats.streak.best,
    currentStreak: progress.stats.streak.current,
    investigationsCount: profile.runs,
    badgesCount: Object.keys(profile.unlocked).length,
  };
}

export interface ProfileUpdateInput {
  displayName?: string;
  username?: string;
  emblem?: EmblemId;
  stats?: UserProfileDoc['stats'];
  exploredYears?: number[];
}

/** Updates user profile fields in Firestore at `users/{uid}`. */
export async function updateCloudProfile(uid: string, updates: ProfileUpdateInput): Promise<boolean> {
  if (!db || !isConfigured || !uid) return false;

  try {
    const payload: Record<string, unknown> = {
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.username) {
      payload.username = cleanUsername(updates.username);
    }
    if (updates.displayName) {
      payload.displayName = updates.displayName.trim();
    }

    const ref = doc(db, 'users', uid);
    await setDoc(ref, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('Could not update user profile in Firestore:', err);
    return false;
  }
}

/** Synchronizes aggregated statistics and explored years from local store to Firestore. */
export async function syncCloudStats(uid: string, progress: ProgressState, profile: ProfileData): Promise<boolean> {
  if (!db || !isConfigured || !uid) return false;

  const stats = buildUserStats(progress, profile);
  return updateCloudProfile(uid, {
    stats,
    exploredYears: profile.exploredYears,
  });
}

/** Fetches the latest cloud profile for a user. */
export async function getCloudProfile(uid: string): Promise<UserProfileDoc | null> {
  if (!db || !isConfigured || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch cloud profile:', err);
    return null;
  }
}
