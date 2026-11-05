import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { calculateScore, getMonthlyPeriodKey, getWeeklyPeriodKey } from './scoring';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const submitChallengeGuess = onCall(async (request) => {
  // 1. Enforce authentication
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to submit a verified challenge attempt.');
  }

  const data = request.data;
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Missing submission payload.');
  }

  const { seed, difficulty, daily, refDate, intervalStart, intervalEnd, startYear, endYear, guess, hintsUsed } = data;

  // 2. Strict input validation
  if (typeof guess !== 'number' || !Number.isInteger(guess) || guess < 1800 || guess > 2100) {
    throw new HttpsError('invalid-argument', 'Invalid guess year. Must be an integer between 1800 and 2100.');
  }
  if (
    typeof startYear !== 'number' ||
    !Number.isInteger(startYear) ||
    typeof endYear !== 'number' ||
    !Number.isInteger(endYear) ||
    startYear > endYear ||
    startYear < 1000 ||
    endYear > 3000
  ) {
    throw new HttpsError('invalid-argument', 'Invalid challenge year span.');
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    throw new HttpsError('invalid-argument', 'Invalid difficulty tier.');
  }

  const cleanDaily = typeof daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily) ? daily : null;
  const cleanHints = typeof hintsUsed === 'number' && Number.isInteger(hintsUsed) ? Math.max(0, Math.min(10, hintsUsed)) : 0;

  // 3. Prevent duplicate daily challenge exploitation
  if (cleanDaily) {
    const existingDaily = await db
      .collection('users')
      .doc(uid)
      .collection('challenges')
      .where('daily', '==', cleanDaily)
      .limit(1)
      .get();
    if (!existingDaily.empty) {
      throw new HttpsError('already-exists', 'Daily challenge has already been completed for this date.');
    }
  }

  // 4. Server-authoritative score calculation
  const scored = calculateScore(guess, { startYear, endYear }, cleanHints);
  const now = Date.now();
  const attemptId = `att_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const challengeDoc = {
    id: attemptId,
    userId: uid,
    seed: String(seed || '').slice(0, 64),
    difficulty,
    daily: cleanDaily,
    refDate: String(refDate || '').slice(0, 10),
    intervalStart: String(intervalStart || '').slice(0, 10),
    intervalEnd: String(intervalEnd || '').slice(0, 10),
    startYear,
    endYear,
    guess,
    distance: scored.distance,
    base: scored.base,
    penalty: scored.penalty,
    points: scored.points,
    hintsUsed: cleanHints,
    playedAt: now,
    verified: true,
  };

  // 5. Write challenge attempt via Admin SDK (client writes are blocked by security rules)
  await db.collection('users').doc(uid).collection('challenges').doc(attemptId).set(challengeDoc);

  // 6. Fetch user profile for display metadata
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const username = String(userData.username || `detective_${uid.slice(0, 6)}`).slice(0, 20);
  const displayName = String(userData.displayName || 'Anonymous Detective').slice(0, 30);
  const emblem = ['compass', 'globe', 'lens', 'quill', 'anchor', 'star'].includes(userData.emblem)
    ? userData.emblem
    : 'compass';

  const stats = userData.stats || {
    totalPoints: 0,
    challengesPlayed: 0,
    bestStreak: 0,
    currentStreak: 0,
  };

  const good = scored.points >= 80;
  const currentStreak = good ? (stats.currentStreak || 0) + 1 : 0;
  const bestStreak = Math.max(stats.bestStreak || 0, currentStreak);

  await userRef.set(
    {
      stats: {
        totalPoints: (stats.totalPoints || 0) + scored.points,
        challengesPlayed: (stats.challengesPlayed || 0) + 1,
        currentStreak,
        bestStreak,
      },
      updatedAt: now,
    },
    { merge: true },
  );

  // 7. Atomic Leaderboard Aggregations (Global, Weekly, Monthly)
  const nowDate = new Date(now);
  const weekKey = getWeeklyPeriodKey(nowDate);
  const monthKey = getMonthlyPeriodKey(nowDate);

  const updateLeaderboardEntry = async (entryRef: FirebaseFirestore.DocumentReference, periodKey: string) => {
    const snap = await entryRef.get();
    const cur = snap.exists ? snap.data() || {} : {};
    await entryRef.set(
      {
        uid,
        username,
        displayName,
        emblem,
        points: (cur.points || 0) + scored.points,
        challengesPlayed: (cur.challengesPlayed || 0) + 1,
        bestStreak: Math.max(cur.bestStreak || 0, bestStreak),
        period: periodKey,
        updatedAt: now,
      },
      { merge: true },
    );
  };

  await Promise.all([
    updateLeaderboardEntry(db.collection('leaderboards').doc('global').collection('entries').doc(uid), 'global'),
    updateLeaderboardEntry(
      db.collection('leaderboards').doc('weekly').collection('periods').doc(weekKey).collection('entries').doc(uid),
      weekKey,
    ),
    updateLeaderboardEntry(
      db.collection('leaderboards').doc('monthly').collection('periods').doc(monthKey).collection('entries').doc(uid),
      monthKey,
    ),
  ]);

  return {
    success: true,
    attemptId,
    verified: true,
    points: scored.points,
    distance: scored.distance,
    base: scored.base,
    penalty: scored.penalty,
  };
});
