import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, isConfigured } from '../lib/firebase';
import { firestorePaths, getMonthlyPeriodKey, getWeeklyPeriodKey } from '../lib/firestorePaths';
import type { LeaderboardEntryDoc, LeaderboardPeriodType } from '../types/database';

export { getMonthlyPeriodKey, getWeeklyPeriodKey };

/**
 * Fetches rankings for a given period ('global' | 'weekly' | 'monthly').
 * Attaches calculated rank positions (1-indexed).
 */
export async function fetchLeaderboard(
  period: LeaderboardPeriodType,
  periodKey?: string,
  limitCount = 50,
): Promise<LeaderboardEntryDoc[]> {
  if (!db || !isConfigured) return [];

  const key =
    periodKey ||
    (period === 'weekly'
      ? getWeeklyPeriodKey()
      : period === 'monthly'
        ? getMonthlyPeriodKey()
        : 'global');

  try {
    const colPath = firestorePaths.leaderboardCollection(period, key);
    const colRef = collection(db, colPath);
    const q = query(colRef, orderBy('points', 'desc'), limit(limitCount));
    const snap = await getDocs(q);

    const entries: LeaderboardEntryDoc[] = [];
    let rank = 1;
    for (const d of snap.docs) {
      const data = d.data() as Partial<LeaderboardEntryDoc>;
      if (!data || typeof data.points !== 'number') continue;

      entries.push({
        uid: data.uid || d.id,
        username: data.username || 'detective',
        displayName: data.displayName || 'Anonymous Detective',
        emblem: data.emblem || 'compass',
        points: data.points,
        rank: rank++,
        challengesPlayed: typeof data.challengesPlayed === 'number' ? data.challengesPlayed : 1,
        bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
        period: data.period || key,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
      });
    }

    return entries;
  } catch (err) {
    console.warn(`Could not fetch ${period} leaderboard:`, err);
    return [];
  }
}
