import { verifyFirebaseIdToken } from './auth';
import { executeAtomicChallengeCommit, reconcileUserLeaderboard } from './firestore';
import { calculateScore, getMonthlyPeriodKey, getWeeklyPeriodKey } from './scoring';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Root info endpoint
    if (url.pathname === '/' || url.pathname === '') {
      return jsonResponse({
        status: 'ok',
        service: 'globe-detective-worker',
        endpoints: {
          health: '/api/health',
          submit: 'POST /api/challenge/submit',
        },
      });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'globe-detective-worker', now: Date.now() });
    }

    // Submit challenge endpoint
    if (url.pathname === '/api/challenge/submit' && request.method === 'POST') {
      try {
        // 1. Verify Authorization Header
        const authHeader = request.headers.get('Authorization') || '';
        const match = authHeader.match(/^Bearer\s+(.+)$/);
        if (!match) {
          return jsonResponse({ error: 'Missing or malformed Authorization header (Bearer token required).' }, 401);
        }

        const idToken = match[1];
        let decodedToken;
        try {
          decodedToken = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
        } catch (authErr) {
          return jsonResponse({ error: `Authentication failed: ${(authErr as Error).message}` }, 401);
        }

        const uid = decodedToken.uid;

        // 2. Parse & Validate Payload
        const body = (await request.json()) as Record<string, unknown>;
        const { seed, difficulty, daily, refDate, intervalStart, intervalEnd, startYear, endYear, guess, hintsUsed } = body;

        if (typeof guess !== 'number' || !Number.isInteger(guess) || guess < 1800 || guess > 2100) {
          return jsonResponse({ error: 'Invalid guess year. Must be an integer between 1800 and 2100.' }, 400);
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
          return jsonResponse({ error: 'Invalid challenge year span.' }, 400);
        }
        if (!['easy', 'medium', 'hard'].includes(String(difficulty))) {
          return jsonResponse({ error: 'Invalid difficulty tier.' }, 400);
        }

        const cleanDaily = typeof daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily) ? daily : null;
        const cleanHints =
          typeof hintsUsed === 'number' && Number.isInteger(hintsUsed)
            ? Math.max(0, Math.min(10, hintsUsed))
            : 0;

        // 3. Trusted Score Calculation
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

        const nowDate = new Date(now);
        const weekKey = getWeeklyPeriodKey(nowDate);
        const monthKey = getMonthlyPeriodKey(nowDate);

        // 4. Atomic Firestore Transaction (Attempt write + replay check + stats + leaderboards)
        await executeAtomicChallengeCommit({
          creds: {
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKeyPem: env.FIREBASE_PRIVATE_KEY,
          },
          uid,
          attemptId,
          challengeDoc,
          scoredPoints: scored.points,
          dailyKey: cleanDaily,
          weekKey,
          monthKey,
        });

        return jsonResponse({
          success: true,
          attemptId,
          verified: true,
          points: scored.points,
          distance: scored.distance,
          base: scored.base,
          penalty: scored.penalty,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('DUPLICATE_DAILY_CHALLENGE')) {
          return jsonResponse({ error: 'Daily challenge already completed for this date.' }, 409);
        }
        console.error('Worker submission error:', message);
        return jsonResponse({ error: `Server error processing challenge: ${message}` }, 500);
      }
    }

    // Reconcile challenge scores & leaderboard endpoint
    if (url.pathname === '/api/challenge/reconcile' && request.method === 'POST') {
      try {
        const authHeader = request.headers.get('Authorization') || '';
        const match = authHeader.match(/^Bearer\s+(.+)$/);
        if (!match) {
          return jsonResponse({ error: 'Missing Authorization header.' }, 401);
        }

        const idToken = match[1];
        const decodedToken = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
        const uid = decodedToken.uid;
        const body = (await request.json().catch(() => ({}))) as { claimedPoints?: number; claimedPlayed?: number };

        const now = Date.now();
        const nowDate = new Date(now);
        const weekKey = getWeeklyPeriodKey(nowDate);
        const monthKey = getMonthlyPeriodKey(nowDate);

        const result = await reconcileUserLeaderboard({
          creds: {
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKeyPem: env.FIREBASE_PRIVATE_KEY,
          },
          uid,
          claimedPoints: typeof body.claimedPoints === 'number' ? body.claimedPoints : undefined,
          claimedPlayed: typeof body.claimedPlayed === 'number' ? body.claimedPlayed : undefined,
          weekKey,
          monthKey,
        });

        return jsonResponse({ success: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Reconciliation error:', message);
        return jsonResponse({ error: `Reconciliation failed: ${message}` }, 500);
      }
    }

    return jsonResponse({ error: 'Endpoint not found' }, 404);
  },
};
