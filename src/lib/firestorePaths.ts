import type { LeaderboardPeriodType } from '../types/database';

/** Path builders for Firestore collections and documents */
export const firestorePaths = {
  user: (uid: string) => `users/${uid}`,
  users: () => 'users',

  userInvestigations: (uid: string) => `users/${uid}/investigations`,
  userInvestigation: (uid: string, invId: string) => `users/${uid}/investigations/${invId}`,

  userChallenges: (uid: string) => `users/${uid}/challenges`,
  userChallenge: (uid: string, attemptId: string) => `users/${uid}/challenges/${attemptId}`,

  userAchievements: (uid: string) => `users/${uid}/achievements`,
  userAchievement: (uid: string, badgeId: string) => `users/${uid}/achievements/${badgeId}`,

  leaderboardCollection: (type: LeaderboardPeriodType, periodKey = 'global') => {
    if (type === 'global') return 'leaderboards/global/entries';
    return `leaderboards/${type}/periods/${periodKey}/entries`;
  },
  leaderboardEntry: (type: LeaderboardPeriodType, uid: string, periodKey = 'global') => {
    if (type === 'global') return `leaderboards/global/entries/${uid}`;
    return `leaderboards/${type}/periods/${periodKey}/entries/${uid}`;
  },
};

/**
 * Returns ISO week key for weekly leaderboards, e.g. "2026-W45".
 * Follows ISO 8601 (week starting on Monday).
 */
export function getWeeklyPeriodKey(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Returns month key for monthly leaderboards, e.g. "2026-11".
 */
export function getMonthlyPeriodKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
