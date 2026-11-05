import { describe, expect, it } from 'vitest';
import {
  fetchLeaderboard,
  getMonthlyPeriodKey,
  getWeeklyPeriodKey,
} from '../leaderboardService';

describe('leaderboardService', () => {
  describe('period key formatters', () => {
    it('getWeeklyPeriodKey generates valid ISO week strings', () => {
      const d1 = new Date('2026-01-05T00:00:00Z');
      expect(getWeeklyPeriodKey(d1)).toBe('2026-W02');

      const nowKey = getWeeklyPeriodKey();
      expect(nowKey).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('getMonthlyPeriodKey generates valid YYYY-MM strings', () => {
      const d1 = new Date('2026-04-15T00:00:00Z');
      expect(getMonthlyPeriodKey(d1)).toBe('2026-04');

      const nowKey = getMonthlyPeriodKey();
      expect(nowKey).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('fetchLeaderboard unconfigured fallback', () => {
    it('returns empty array safely when Firebase is unconfigured in test environment', async () => {
      expect(await fetchLeaderboard('global')).toEqual([]);
      expect(await fetchLeaderboard('weekly')).toEqual([]);
      expect(await fetchLeaderboard('monthly')).toEqual([]);
    });
  });
});
