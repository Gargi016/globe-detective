import { loadProgress } from '../challenge/progress';
import type { SafeStorage } from '../detective/investigation';
import { unlockNew } from './achievements';
import type { AchievementDef } from './achievements';
import { loadProfile, saveProfile } from './profileStore';

/** Reads everything, stamps newly earned badges, saves, and returns the new ones. Safe to call at any time. */
export function syncAchievements(store: SafeStorage | null, now = Date.now()): AchievementDef[] {
  const profile = loadProfile(store);
  const challenge = loadProgress(store);
  const { profile: next, added } = unlockNew({ profile, challenge }, now);
  if (added.length > 0) saveProfile(store, next);
  return added;
}
