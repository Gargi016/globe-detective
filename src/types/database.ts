import type { Investigation } from '../detective/investigation';
import type { EmblemId } from '../profile/profileStore';
import type { Difficulty } from '../challenge/generator';

/** User profile stored in Firestore at `/users/{uid}`. */
export interface UserProfileDoc {
  uid: string;
  email: string | null;
  username: string;
  displayName: string;
  emblem: EmblemId;
  createdAt: number;
  updatedAt: number;
  stats: {
    totalPoints: number;
    challengesPlayed: number;
    bestStreak: number;
    currentStreak: number;
    investigationsCount: number;
    badgesCount: number;
  };
  exploredYears: number[];
}

/** Saved case file stored in Firestore at `/users/{uid}/investigations/{investigationId}`. */
export interface UserInvestigationDoc {
  id: string;
  userId: string;
  name: string;
  savedAt: number;
  updatedAt: number;
  investigation: Investigation;
}

/** Server-verified challenge attempt stored at `/users/{uid}/challenges/{attemptId}`. */
export interface UserChallengeDoc {
  id: string;
  userId: string;
  seed: string;
  difficulty: Difficulty;
  daily: string | null;
  refDate: string;
  intervalStart: string;
  intervalEnd: string;
  startYear: number;
  endYear: number;
  guess: number;
  distance: number;
  base: number;
  penalty: number;
  points: number;
  hintsUsed: number;
  playedAt: number;
  verified: boolean;
}

/** Unlocked achievement stored in Firestore at `/users/{uid}/achievements/{badgeId}`. */
export interface UserAchievementDoc {
  id: string;
  userId: string;
  unlockedAt: number;
}

export type LeaderboardPeriodType = 'global' | 'weekly' | 'monthly';

/** Leaderboard ranking entry stored at `/leaderboards/{type}/entries/{uid}` or subcollection. */
export interface LeaderboardEntryDoc {
  uid: string;
  username: string;
  displayName: string;
  emblem: EmblemId;
  points: number;
  rank?: number;
  challengesPlayed: number;
  bestStreak: number;
  period: string; // 'global', '2026-W45', '2026-11'
  updatedAt: number;
}
