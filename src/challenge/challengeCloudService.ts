import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, isConfigured } from '../lib/firebase';
import { firestorePaths } from '../lib/firestorePaths';
import type { Difficulty } from './generator';
import type { ChallengeResult } from './progress';
import { scoreGuess } from './scoring';
import type { GuessScore } from './scoring';
import type { UserChallengeDoc } from '../types/database';

export interface SubmitChallengeInput {
  seed: string;
  difficulty: Difficulty;
  daily: string | null;
  refDate: string;
  intervalStart: string;
  intervalEnd: string;
  startYear: number;
  endYear: number;
  guess: number;
  hintsUsed: number;
}

export interface SubmitChallengeResult {
  attemptId: string;
  verified: boolean;
  score: GuessScore;
}

/**
 * Submits a challenge attempt:
 * 1. If VITE_WORKER_API_URL is configured and user is signed in, submits to Cloudflare Worker with Firebase ID Token.
 * 2. If Cloudflare Worker is not configured, falls back to Firebase Cloud Functions (submitChallengeGuess).
 * 3. In Guest Mode, offline, or when unconfigured, falls back to trusted local calculation.
 */
export async function submitChallengeAttempt(
  input: SubmitChallengeInput,
  userUid?: string | null,
): Promise<SubmitChallengeResult> {
  const localScore = scoreGuess(input.guess, { startYear: input.startYear, endYear: input.endYear }, input.hintsUsed);
  const localAttemptId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // Guest Mode: calculate locally
  if (!userUid) {
    return {
      attemptId: localAttemptId,
      verified: false,
      score: localScore,
    };
  }

  // 1. Primary Strategy: Cloudflare Worker endpoint (Free Tier)
  const workerApiUrl = (import.meta.env.VITE_WORKER_API_URL as string | undefined)?.trim();
  if (workerApiUrl && auth?.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${workerApiUrl.replace(/\/+$/, '')}/api/challenge/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(input),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          success?: boolean;
          attemptId?: string;
          verified?: boolean;
          points?: number;
          distance?: number;
          base?: number;
          penalty?: number;
        };

        if (data.success && typeof data.points === 'number') {
          return {
            attemptId: data.attemptId || localAttemptId,
            verified: true,
            score: {
              ...localScore,
              points: data.points,
              distance: typeof data.distance === 'number' ? data.distance : localScore.distance,
              base: typeof data.base === 'number' ? data.base : localScore.base,
              penalty: typeof data.penalty === 'number' ? data.penalty : localScore.penalty,
            },
          };
        }
      } else {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        console.error(`Worker challenge submission error (HTTP ${res.status}):`, errJson.error || errJson);
      }
    } catch (workerErr) {
      console.warn('Cloudflare Worker request failed; falling back to Firebase function or local:', workerErr);
    }
  }

  // 2. Secondary Strategy: Firebase Cloud Functions (if Blaze plan is active)
  if (functions && isConfigured) {
    try {
      const callFn = httpsCallable<
        SubmitChallengeInput,
        {
          success: boolean;
          attemptId: string;
          verified: boolean;
          points: number;
          distance: number;
          base: number;
          penalty: number;
        }
      >(functions, 'submitChallengeGuess');

      const res = await callFn(input);
      if (res.data?.success) {
        return {
          attemptId: res.data.attemptId || localAttemptId,
          verified: true,
          score: {
            ...localScore,
            points: res.data.points,
            distance: res.data.distance,
            base: res.data.base,
            penalty: res.data.penalty,
          },
        };
      }
    } catch (err) {
      console.warn('Cloud Function scoring failed; falling back to local scoring:', err);
    }
  }

  // 3. Fallback: Local scoring
  return {
    attemptId: localAttemptId,
    verified: false,
    score: localScore,
  };
}

/** Fetches verified challenge attempts from Firestore for an authenticated user. */
export async function fetchCloudChallenges(uid: string, maxItems = 100): Promise<ChallengeResult[]> {
  if (!db || !isConfigured || !uid) return [];

  try {
    const colRef = collection(db, firestorePaths.userChallenges(uid));
    const q = query(colRef, orderBy('playedAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);

    const results: ChallengeResult[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Partial<UserChallengeDoc>;
      if (!data || typeof data.id !== 'string' || typeof data.points !== 'number') continue;

      results.push({
        id: data.id,
        seed: data.seed ?? '',
        difficulty: data.difficulty ?? 'medium',
        daily: data.daily ?? null,
        refDate: data.refDate ?? '',
        intervalStart: data.intervalStart ?? '',
        intervalEnd: data.intervalEnd ?? '',
        startYear: data.startYear ?? 1900,
        endYear: data.endYear ?? 1900,
        guess: data.guess ?? 1900,
        distance: data.distance ?? 0,
        base: data.base ?? data.points,
        penalty: data.penalty ?? 0,
        points: data.points,
        hintsUsed: data.hintsUsed ?? 0,
        playedAt: data.playedAt ?? Date.now(),
      });
    }

    return results;
  } catch (err) {
    console.warn('Could not fetch cloud challenges:', err);
    return [];
  }
}
