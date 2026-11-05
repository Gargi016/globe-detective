import { describe, expect, it } from 'vitest';
import { newProgress, recordResult } from '../../challenge/progress';
import type { ChallengeResult, ProgressState } from '../../challenge/progress';
import { newProfile, withInvestigationRun } from '../profileStore';
import type { RunInput } from '../profileStore';
import {
  buildUserStats,
  getCloudProfile,
  syncCloudStats,
  updateCloudProfile,
} from '../userProfileService';
import { newInvestigation } from '../../detective/investigation';

const sampleResult = (over: Partial<ChallengeResult> = {}): ChallengeResult => ({
  id: 'res-1',
  seed: 'test-seed',
  difficulty: 'medium',
  daily: null,
  refDate: '1970-01-01',
  intervalStart: '1969-01-01',
  intervalEnd: '1971-01-01',
  startYear: 1969,
  endYear: 1971,
  guess: 1970,
  distance: 0,
  base: 100,
  penalty: 0,
  points: 100,
  hintsUsed: 0,
  playedAt: Date.now(),
  ...over,
});

const sampleRun = (over: Partial<RunInput> = {}): RunInput => ({
  name: 'Case Alpha',
  clueCount: 3,
  status: 'ok',
  rangeText: '1970–1975',
  widthYears: 5,
  confidence: 'high',
  labels: ['Soviet Union exists'],
  investigation: newInvestigation('Case Alpha'),
  ...over,
});

describe('userProfileService', () => {
  describe('buildUserStats', () => {
    it('accurately compiles statistics from progress and profile objects', () => {
      let progress: ProgressState = newProgress();
      progress = recordResult(progress, sampleResult({ points: 100, distance: 0 }));
      progress = recordResult(progress, sampleResult({ id: 'res-2', points: 80, distance: 2 }));

      let profile = newProfile();
      profile = withInvestigationRun(profile, sampleRun());
      profile = withInvestigationRun(profile, sampleRun({ id: 'case-2' }));
      profile.unlocked = { 'first-challenge': 123, 'perfect-guess': 456 };

      const stats = buildUserStats(progress, profile);

      expect(stats.totalPoints).toBe(180);
      expect(stats.challengesPlayed).toBe(2);
      expect(stats.bestStreak).toBeGreaterThanOrEqual(1);
      expect(stats.investigationsCount).toBe(2);
      expect(stats.badgesCount).toBe(2);
    });

    it('handles zero/empty initial states', () => {
      const stats = buildUserStats(newProgress(), newProfile());
      expect(stats).toEqual({
        totalPoints: 0,
        challengesPlayed: 0,
        bestStreak: 0,
        currentStreak: 0,
        investigationsCount: 0,
        badgesCount: 0,
      });
    });
  });

  describe('unconfigured cloud fallback behavior', () => {
    it('returns false/null safely when Firebase is unconfigured in test environment', async () => {
      const updateResult = await updateCloudProfile('user-123', {
        displayName: 'Test Detective',
        username: 'detective_1',
      });
      expect(updateResult).toBe(false);

      const emptyUidResult = await updateCloudProfile('', { displayName: 'Ghost' });
      expect(emptyUidResult).toBe(false);

      const syncResult = await syncCloudStats('user-123', newProgress(), newProfile());
      expect(syncResult).toBe(false);

      const fetched = await getCloudProfile('user-123');
      expect(fetched).toBeNull();
    });
  });
});
