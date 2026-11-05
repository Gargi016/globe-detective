import { describe, expect, it } from 'vitest';
import {
  fetchCloudAchievements,
  mergeAchievements,
  reconcileAchievements,
  saveCloudAchievement,
  syncAchievementsWithCloud,
} from '../achievementCloudService';
import { newProfile } from '../profileStore';

describe('achievementCloudService', () => {
  describe('mergeAchievements', () => {
    it('returns empty object when both inputs are empty', () => {
      expect(mergeAchievements({}, {})).toEqual({});
    });

    it('combines badges from local and cloud', () => {
      const local = { 'first-investigation': 1000 };
      const cloud = { 'first-challenge': 2000 };

      const merged = mergeAchievements(local, cloud);
      expect(merged).toEqual({
        'first-investigation': 1000,
        'first-challenge': 2000,
      });
    });

    it('retains the earliest timestamp when a badge exists in both', () => {
      const local = { 'perfect-guess': 5000 };
      const cloud = { 'perfect-guess': 3000 };

      const merged = mergeAchievements(local, cloud);
      expect(merged['perfect-guess']).toBe(3000);

      const localEarlier = { 'perfect-guess': 2000 };
      const cloudLater = { 'perfect-guess': 4000 };

      expect(mergeAchievements(localEarlier, cloudLater)['perfect-guess']).toBe(2000);
    });
  });

  describe('reconcileAchievements', () => {
    it('returns the same profile reference when nothing changes', () => {
      const p = newProfile();
      p.unlocked = { 'first-investigation': 1000 };

      const reconciled = reconcileAchievements(p, { 'first-investigation': 1000 });
      expect(reconciled).toBe(p);
    });

    it('returns an updated profile when new cloud badges are added', () => {
      const p = newProfile();
      p.unlocked = { 'first-investigation': 1000 };

      const reconciled = reconcileAchievements(p, { 'border-detective': 2000 });
      expect(reconciled).not.toBe(p);
      expect(reconciled.unlocked).toEqual({
        'first-investigation': 1000,
        'border-detective': 2000,
      });
    });
  });

  describe('unconfigured cloud fallback behavior', () => {
    it('handles saveCloudAchievement safely when unconfigured', async () => {
      expect(await saveCloudAchievement('uid-1', 'badge-1')).toBe(false);
      expect(await saveCloudAchievement('', 'badge-1')).toBe(false);
      expect(await saveCloudAchievement('uid-1', '')).toBe(false);
    });

    it('handles fetchCloudAchievements safely when unconfigured', async () => {
      expect(await fetchCloudAchievements('uid-1')).toEqual({});
      expect(await fetchCloudAchievements('')).toEqual({});
    });

    it('returns local achievements intact from syncAchievementsWithCloud when unconfigured', async () => {
      const local = { 'first-challenge': 1234 };
      expect(await syncAchievementsWithCloud('uid-1', local)).toEqual(local);
      expect(await syncAchievementsWithCloud('', local)).toEqual(local);
    });
  });
});
