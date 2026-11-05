import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isConfigured } from '../lib/firebase';
import { firestorePaths } from '../lib/firestorePaths';
import type { UserAchievementDoc } from '../types/database';
import type { ProfileData } from './profileStore';

/**
 * Merges local and cloud unlocked achievement maps.
 * For badges present in both, keeps the earliest unlocked timestamp.
 */
export function mergeAchievements(
  local: Record<string, number>,
  cloud: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...local };

  for (const [badgeId, cloudAt] of Object.entries(cloud)) {
    if (typeof cloudAt !== 'number' || !Number.isFinite(cloudAt)) continue;
    if (merged[badgeId] === undefined) {
      merged[badgeId] = cloudAt;
    } else {
      merged[badgeId] = Math.min(merged[badgeId], cloudAt);
    }
  }

  return merged;
}

/** Saves a single unlocked achievement to Firestore under `users/{uid}/achievements/{badgeId}`. */
export async function saveCloudAchievement(
  uid: string,
  badgeId: string,
  unlockedAt = Date.now(),
): Promise<boolean> {
  if (!db || !isConfigured || !uid || !badgeId) return false;

  try {
    const docData: UserAchievementDoc = {
      id: badgeId,
      userId: uid,
      unlockedAt,
    };
    const ref = doc(db, firestorePaths.userAchievement(uid, badgeId));
    await setDoc(ref, docData, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Could not save achievement ${badgeId} to cloud:`, err);
    return false;
  }
}

/** Fetches all unlocked achievements for a user from Firestore. */
export async function fetchCloudAchievements(uid: string): Promise<Record<string, number>> {
  if (!db || !isConfigured || !uid) return {};

  try {
    const colRef = collection(db, firestorePaths.userAchievements(uid));
    const snapshot = await getDocs(colRef);
    const results: Record<string, number> = {};

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Partial<UserAchievementDoc>;
      if (!data || typeof data.id !== 'string') continue;
      const at = typeof data.unlockedAt === 'number' ? data.unlockedAt : Date.now();
      results[data.id] = at;
    }

    return results;
  } catch (err) {
    console.warn('Could not fetch cloud achievements:', err);
    return {};
  }
}

/**
 * Synchronizes local unlocked achievements with Firestore:
 * 1. Fetches cloud achievements.
 * 2. Uploads any local badges not yet in the cloud.
 * 3. Returns the merged map of unlocked badges.
 */
export async function syncAchievementsWithCloud(
  uid: string,
  localUnlocked: Record<string, number>,
): Promise<Record<string, number>> {
  if (!db || !isConfigured || !uid) return { ...localUnlocked };

  try {
    const cloudUnlocked = await fetchCloudAchievements(uid);
    const merged = mergeAchievements(localUnlocked, cloudUnlocked);

    // Upload any local badges missing from cloud
    for (const [badgeId, at] of Object.entries(localUnlocked)) {
      if (cloudUnlocked[badgeId] === undefined) {
        await saveCloudAchievement(uid, badgeId, at);
      }
    }

    return merged;
  } catch (err) {
    console.warn('Could not synchronize achievements with cloud:', err);
    return { ...localUnlocked };
  }
}

/** Reconciles a ProfileData object with cloud-unlocked badges. */
export function reconcileAchievements(
  profile: ProfileData,
  cloudUnlocked: Record<string, number>,
): ProfileData {
  const merged = mergeAchievements(profile.unlocked, cloudUnlocked);
  const keysBefore = Object.keys(profile.unlocked);
  const keysAfter = Object.keys(merged);

  if (keysBefore.length === keysAfter.length && keysBefore.every((k) => profile.unlocked[k] === merged[k])) {
    return profile;
  }

  return {
    ...profile,
    unlocked: merged,
  };
}
