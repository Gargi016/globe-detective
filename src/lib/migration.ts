import { isConfigured } from './firebase';
import type { SafeStorage } from '../detective/investigation';
import { listSaved } from '../detective/investigation';
import { fetchCloudInvestigations, saveCloudInvestigation } from '../detective/investigationCloudService';
import { DEFAULT_NAME, loadProfile } from '../profile/profileStore';
import { fetchCloudAchievements, saveCloudAchievement } from '../profile/achievementCloudService';
import { loadProgress } from '../challenge/progress';
import { getCloudProfile, syncCloudStats, updateCloudProfile } from '../profile/userProfileService';

export const MIGRATION_KEY_PREFIX = 'globe-detective:migrated:';

export interface MigrationReport {
  profileMigrated: boolean;
  investigationsCount: number;
  achievementsCount: number;
  challengesCount: number;
  skipped: boolean;
}

/**
 * Migrates local storage data into Firestore for an authenticated user.
 * - Leaves local data intact (no data loss).
 * - Prevents duplicate investigations or duplicate achievements.
 * - Sets a per-user migration marker in SafeStorage to avoid redundant round-trips.
 */
export async function migrateLocalStorageToCloud(
  uid: string,
  store: SafeStorage | null,
): Promise<MigrationReport> {
  const emptyReport: MigrationReport = {
    profileMigrated: false,
    investigationsCount: 0,
    achievementsCount: 0,
    challengesCount: 0,
    skipped: true,
  };

  if (!uid || !isConfigured || !store) return emptyReport;

  const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
  const alreadyMigrated = store.getItem(migrationKey);

  const localProfile = loadProfile(store);
  const localSaves = listSaved(store);
  const localProgress = loadProgress(store);

  // If already migrated and there are no local saves or achievements, skip
  if (alreadyMigrated && localSaves.length === 0 && Object.keys(localProfile.unlocked).length === 0) {
    return emptyReport;
  }

  let investigationsCount = 0;
  let achievementsCount = 0;
  let profileMigrated = false;

  try {
    // 1. Profile reconciliation
    const cloudProfile = await getCloudProfile(uid);
    if (cloudProfile) {
      const mergedYears = Array.from(new Set([...cloudProfile.exploredYears, ...localProfile.exploredYears]))
        .sort((a, b) => a - b)
        .slice(0, 200);

      const updates: Record<string, unknown> = {
        exploredYears: mergedYears,
      };

      if (cloudProfile.displayName === 'Anonymous Detective' && localProfile.name !== DEFAULT_NAME) {
        updates.displayName = localProfile.name;
      }
      if (cloudProfile.emblem === 'compass' && localProfile.emblem !== 'compass') {
        updates.emblem = localProfile.emblem;
      }

      await updateCloudProfile(uid, updates);
      profileMigrated = true;
    }

    // 2. Investigations migration (no duplicates)
    if (localSaves.length > 0) {
      const cloudSaves = await fetchCloudInvestigations(uid);
      const cloudIds = new Set(cloudSaves.map((s) => s.id));
      const cloudNames = new Set(cloudSaves.map((s) => s.name.toLowerCase()));

      for (const save of localSaves) {
        if (!cloudIds.has(save.id) && !cloudNames.has(save.name.toLowerCase())) {
          const res = await saveCloudInvestigation(uid, save.investigation, save.id, save.savedAt);
          if (res.ok) {
            investigationsCount++;
          }
        }
      }
    }

    // 3. Achievements migration (no duplicates)
    const localBadges = Object.entries(localProfile.unlocked);
    if (localBadges.length > 0) {
      const cloudBadges = await fetchCloudAchievements(uid);
      for (const [badgeId, unlockedAt] of localBadges) {
        if (cloudBadges[badgeId] === undefined) {
          const ok = await saveCloudAchievement(uid, badgeId, unlockedAt);
          if (ok) {
            achievementsCount++;
          }
        }
      }
    }

    // 4. Synchronize aggregate statistics to users/{uid}
    await syncCloudStats(uid, localProgress, localProfile);

    // 5. Mark migration complete in local storage
    store.setItem(migrationKey, String(Date.now()));

    return {
      profileMigrated,
      investigationsCount,
      achievementsCount,
      challengesCount: localProgress.history.length,
      skipped: false,
    };
  } catch (err) {
    console.warn('Migration encountered an error:', err);
    return {
      profileMigrated,
      investigationsCount,
      achievementsCount,
      challengesCount: 0,
      skipped: false,
    };
  }
}
