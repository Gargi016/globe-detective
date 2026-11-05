import { describe, expect, it } from 'vitest';
import { firestorePaths, getMonthlyPeriodKey, getWeeklyPeriodKey } from '../firestorePaths';
import type {
  LeaderboardEntryDoc,
  UserAchievementDoc,
  UserChallengeDoc,
  UserInvestigationDoc,
  UserProfileDoc,
} from '../../types/database';

describe('Firestore Schema & Path Builders', () => {
  it('builds canonical user and subcollection paths', () => {
    const uid = 'detective_42';
    expect(firestorePaths.user(uid)).toBe('users/detective_42');
    expect(firestorePaths.users()).toBe('users');
    expect(firestorePaths.userInvestigations(uid)).toBe('users/detective_42/investigations');
    expect(firestorePaths.userInvestigation(uid, 'inv_101')).toBe('users/detective_42/investigations/inv_101');
    expect(firestorePaths.userChallenges(uid)).toBe('users/detective_42/challenges');
    expect(firestorePaths.userChallenge(uid, 'ch_202')).toBe('users/detective_42/challenges/ch_202');
    expect(firestorePaths.userAchievements(uid)).toBe('users/detective_42/achievements');
    expect(firestorePaths.userAchievement(uid, 'first-investigation')).toBe('users/detective_42/achievements/first-investigation');
  });

  it('builds correct leaderboard paths for all timeframes', () => {
    expect(firestorePaths.leaderboardCollection('global')).toBe('leaderboards/global/entries');
    expect(firestorePaths.leaderboardEntry('global', 'user_1')).toBe('leaderboards/global/entries/user_1');

    expect(firestorePaths.leaderboardCollection('weekly', '2026-W45')).toBe('leaderboards/weekly/periods/2026-W45/entries');
    expect(firestorePaths.leaderboardEntry('weekly', 'user_1', '2026-W45')).toBe('leaderboards/weekly/periods/2026-W45/entries/user_1');

    expect(firestorePaths.leaderboardCollection('monthly', '2026-11')).toBe('leaderboards/monthly/periods/2026-11/entries');
    expect(firestorePaths.leaderboardEntry('monthly', 'user_1', '2026-11')).toBe('leaderboards/monthly/periods/2026-11/entries/user_1');
  });

  it('formats ISO weekly and monthly period keys accurately', () => {
    // 5 Nov 2026 is in week 45 of 2026
    const date = new Date(Date.UTC(2026, 10, 5));
    expect(getWeeklyPeriodKey(date)).toBe('2026-W45');
    expect(getMonthlyPeriodKey(date)).toBe('2026-11');

    // 1 Jan 2026
    const newYear = new Date(Date.UTC(2026, 0, 1));
    expect(getWeeklyPeriodKey(newYear)).toBe('2026-W01');
    expect(getMonthlyPeriodKey(newYear)).toBe('2026-01');
  });

  it('validates TypeScript database schema interfaces structure', () => {
    const profile: UserProfileDoc = {
      uid: 'user_123',
      email: 'detective@example.com',
      username: 'sherlock',
      displayName: 'Sherlock Holmes',
      emblem: 'lens',
      createdAt: 1730000000000,
      updatedAt: 1730000000000,
      stats: {
        totalPoints: 1250,
        challengesPlayed: 15,
        bestStreak: 8,
        currentStreak: 4,
        investigationsCount: 6,
        badgesCount: 5,
      },
      exploredYears: [1914, 1945, 1991],
    };

    const investigation: UserInvestigationDoc = {
      id: 'inv_1',
      userId: 'user_123',
      name: 'Cold War Case',
      savedAt: 1730000000000,
      updatedAt: 1730000000000,
      investigation: {
        version: 1,
        name: 'Cold War Case',
        observations: [],
        reuseLagYears: 10,
        viewYear: 1960,
        anchor: 'start',
        explored: true,
      },
    };

    const challenge: UserChallengeDoc = {
      id: 'att_1',
      userId: 'user_123',
      seed: 'seed_abc',
      difficulty: 'medium',
      daily: '2026-11-05',
      refDate: '1962-07-05',
      intervalStart: '1962-07-05',
      intervalEnd: '1964-10-23',
      startYear: 1962,
      endYear: 1964,
      guess: 1963,
      distance: 0,
      base: 100,
      penalty: 0,
      points: 100,
      hintsUsed: 0,
      playedAt: 1730000000000,
      verified: true,
    };

    const achievement: UserAchievementDoc = {
      id: 'first-investigation',
      userId: 'user_123',
      unlockedAt: 1730000000000,
    };

    const entry: LeaderboardEntryDoc = {
      uid: 'user_123',
      username: 'sherlock',
      displayName: 'Sherlock Holmes',
      emblem: 'lens',
      points: 1250,
      challengesPlayed: 15,
      bestStreak: 8,
      period: 'global',
      updatedAt: 1730000000000,
    };

    expect(profile.uid).toBe('user_123');
    expect(investigation.investigation.version).toBe(1);
    expect(challenge.points).toBe(100);
    expect(achievement.id).toBe('first-investigation');
    expect(entry.period).toBe('global');
  });
});
