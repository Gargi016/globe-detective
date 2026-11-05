import { describe, expect, it } from 'vitest';
import {
  fetchCloudChallenges,
  submitChallengeAttempt,
} from '../challengeCloudService';
import { calculateScore, distanceFromInterval, tierFor } from '../../../functions/src/scoring';

describe('challengeCloudService', () => {
  describe('submitChallengeAttempt (fallback / guest mode)', () => {
    it('accurately scores guesses locally when in guest mode or unconfigured', async () => {
      const resExact = await submitChallengeAttempt({
        seed: 'test-seed',
        difficulty: 'medium',
        daily: null,
        refDate: '1975-01-01',
        intervalStart: '1974-01-01',
        intervalEnd: '1976-12-31',
        startYear: 1974,
        endYear: 1976,
        guess: 1975,
        hintsUsed: 0,
      });

      expect(resExact.verified).toBe(false);
      expect(resExact.score.points).toBe(100);
      expect(resExact.score.distance).toBe(0);
      expect(resExact.score.inside).toBe(true);

      const resClose = await submitChallengeAttempt({
        seed: 'test-seed',
        difficulty: 'hard',
        daily: null,
        refDate: '1980-01-01',
        intervalStart: '1980-01-01',
        intervalEnd: '1980-12-31',
        startYear: 1980,
        endYear: 1980,
        guess: 1979,
        hintsUsed: 1,
      });

      expect(resClose.verified).toBe(false);
      expect(resClose.score.points).toBe(95);
      expect(resClose.score.distance).toBe(1);
      expect(resClose.score.penalty).toBe(0); // 0 by default
    });

    it('generates unique attempt IDs', async () => {
      const r1 = await submitChallengeAttempt({
        seed: 's1',
        difficulty: 'easy',
        daily: null,
        refDate: '1960-01-01',
        intervalStart: '1959-01-01',
        intervalEnd: '1961-01-01',
        startYear: 1959,
        endYear: 1961,
        guess: 1960,
        hintsUsed: 0,
      });
      const r2 = await submitChallengeAttempt({
        seed: 's2',
        difficulty: 'easy',
        daily: null,
        refDate: '1960-01-01',
        intervalStart: '1959-01-01',
        intervalEnd: '1961-01-01',
        startYear: 1959,
        endYear: 1961,
        guess: 1960,
        hintsUsed: 0,
      });

      expect(r1.attemptId).not.toBe(r2.attemptId);
      expect(r1.attemptId).toMatch(/^att_/);
    });
  });

  describe('fetchCloudChallenges unconfigured fallback', () => {
    it('returns empty array when unconfigured or empty uid', async () => {
      expect(await fetchCloudChallenges('')).toEqual([]);
      expect(await fetchCloudChallenges('uid-123')).toEqual([]);
    });
  });
});

describe('trusted Cloud Functions scoring (functions/src/scoring)', () => {
  it('correctly calculates distances from year intervals', () => {
    const span = { startYear: 1950, endYear: 1953 };
    expect(distanceFromInterval(1950, span)).toBe(0);
    expect(distanceFromInterval(1952, span)).toBe(0);
    expect(distanceFromInterval(1953, span)).toBe(0);
    expect(distanceFromInterval(1949, span)).toBe(1);
    expect(distanceFromInterval(1955, span)).toBe(2);
  });

  it('correctly assigns score tiers and points', () => {
    expect(tierFor(0).points).toBe(100);
    expect(tierFor(1).points).toBe(95);
    expect(tierFor(3).points).toBe(80);
    expect(tierFor(8).points).toBe(60);
    expect(tierFor(15).points).toBe(30);
    expect(tierFor(30).points).toBe(10);
  });

  it('calculateScore returns server verified score structure', () => {
    const s = calculateScore(1990, { startYear: 1989, endYear: 1991 }, 2);
    expect(s.distance).toBe(0);
    expect(s.points).toBe(100);
    expect(s.base).toBe(100);
    expect(s.penalty).toBe(0);
  });
});
