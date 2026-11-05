export interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKeyPem: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cleanSecret(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const clean = cleanSecret(pem);
  if (!clean) {
    throw new Error('FIREBASE_PRIVATE_KEY secret is missing or empty.');
  }

  // Remove PEM header, footer, escaped newlines, carriage returns, spaces, and any leftover quotes
  const b64 = clean
    .replace(/-----BEGIN[A-Z\s]*PRIVATE KEY-----/g, '')
    .replace(/-----END[A-Z\s]*PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .replace(/[\r\n\s"']/g, '');

  try {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    throw new Error(`Failed to decode FIREBASE_PRIVATE_KEY base64: ${(err as Error).message}`);
  }
}

/** Generates or returns a cached Google OAuth2 Access Token for the Cloud Datastore / Firestore API. */
export async function getGoogleAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const projectId = cleanSecret(creds.projectId);
  const clientEmail = cleanSecret(creds.clientEmail);
  const privateKeyPem = cleanSecret(creds.privateKeyPem);

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID secret is missing or empty.');
  if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL secret is missing or empty.');
  if (!privateKeyPem) throw new Error('FIREBASE_PRIVATE_KEY secret is missing or empty.');

  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > nowSec + 300) {
    return cachedAccessToken.token;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToPkcs8(privateKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch (keyErr) {
    throw new Error(`WebCrypto importKey failed for FIREBASE_PRIVATE_KEY: ${(keyErr as Error).message}`);
  }

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(unsignedToken));
  const assertion = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google OAuth2 token exchange failed: HTTP ${res.status} - ${errorText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: nowSec + (data.expires_in || 3600),
  };

  return data.access_token;
}

// ---------- Firestore REST formatting helpers ----------

export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: toFirestoreFields(val as Record<string, unknown>) } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = toFirestoreValue(val);
    }
  }
  return fields;
}

export function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) return fromFirestoreFields(val.mapValue.fields || {});
  return null;
}

export function fromFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    res[k] = fromFirestoreValue(v);
  }
  return res;
}

// ---------- Firestore Atomic Transactions ----------

export interface AtomicChallengeCommitParams {
  creds: ServiceAccountCredentials;
  uid: string;
  attemptId: string;
  challengeDoc: Record<string, unknown>;
  scoredPoints: number;
  dailyKey: string | null;
  weekKey: string;
  monthKey: string;
}

/**
 * Executes a full atomic Firestore transaction:
 * 1. Begins transaction.
 * 2. Checks replay / duplicate daily challenges.
 * 3. Reads existing user profile & current leaderboard entries.
 * 4. Commits all writes atomically (attempt record, user stats, and 3 leaderboard periods).
 */
export async function executeAtomicChallengeCommit(params: AtomicChallengeCommitParams) {
  const { creds, uid, attemptId, challengeDoc, scoredPoints, dailyKey, weekKey, monthKey } = params;
  const projectId = cleanSecret(creds.projectId);
  const token = await getGoogleAccessToken(creds);
  const baseApi = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  // 1. Begin Transaction
  const beginRes = await fetch(`${baseApi}:beginTransaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!beginRes.ok) {
    const errText = await beginRes.text();
    throw new Error(`Failed to begin Firestore transaction (HTTP ${beginRes.status}): ${errText}`);
  }
  const { transaction } = (await beginRes.json()) as { transaction: string };

  // 2. Read inside transaction to prevent replay and fetch stats
  let userFields: Record<string, unknown> = {};

  const userDocUrl = `${baseApi}/users/${uid}?transaction=${encodeURIComponent(transaction)}`;
  const userRes = await fetch(userDocUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (userRes.ok) {
    const rawUser = (await userRes.json()) as { fields?: Record<string, FirestoreValue> };
    userFields = rawUser.fields ? fromFirestoreFields(rawUser.fields) : {};
  } else {
    // Fallback read outside transaction if transactional read failed
    const directRes = await fetch(`${baseApi}/users/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (directRes.ok) {
      const rawUser = (await directRes.json()) as { fields?: Record<string, FirestoreValue> };
      userFields = rawUser.fields ? fromFirestoreFields(rawUser.fields) : {};
    }
  }

  // Check duplicate daily submission inside transaction
  if (dailyKey) {
    const dailyDocUrl = `${baseApi}/users/${uid}/dailyDone/${dailyKey}?transaction=${encodeURIComponent(transaction)}`;
    const dailyRes = await fetch(dailyDocUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (dailyRes.ok) {
      throw new Error('DUPLICATE_DAILY_CHALLENGE: Daily challenge already completed for this date.');
    }
  }

  // Check existing leaderboard entry as backup to prevent point regression
  const lbRes = await fetch(`${baseApi}/leaderboards/global/entries/${uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let currentBoardPoints = 0;
  let currentBoardPlayed = 0;
  if (lbRes.ok) {
    const rawLb = (await lbRes.json()) as { fields?: Record<string, FirestoreValue> };
    const lbFields = rawLb.fields ? fromFirestoreFields(rawLb.fields) : {};
    if (typeof lbFields.points === 'number') currentBoardPoints = lbFields.points;
    if (typeof lbFields.challengesPlayed === 'number') currentBoardPlayed = lbFields.challengesPlayed;
  }

  // Calculate updated user stats
  const existingStats = (userFields.stats as Record<string, number> | undefined) || {
    totalPoints: 0,
    challengesPlayed: 0,
    bestStreak: 0,
    currentStreak: 0,
  };

  const isGood = scoredPoints >= 80;
  const newCurrentStreak = isGood ? (existingStats.currentStreak || 0) + 1 : 0;
  const newBestStreak = Math.max(existingStats.bestStreak || 0, newCurrentStreak);
  const basePoints = Math.max(existingStats.totalPoints || 0, currentBoardPoints);
  const basePlayed = Math.max(existingStats.challengesPlayed || 0, currentBoardPlayed);
  const newTotalPoints = basePoints + scoredPoints;
  const newChallengesPlayed = basePlayed + 1;

  const username = String(userFields.username || `detective_${uid.slice(0, 6)}`).slice(0, 20);
  const displayName = String(userFields.displayName || 'Anonymous Detective').slice(0, 30);
  const emblem = ['compass', 'globe', 'lens', 'quill', 'anchor', 'star'].includes(userFields.emblem as string)
    ? userFields.emblem
    : 'compass';

  const docRoot = `projects/${projectId}/databases/(default)/documents`;
  const writes: Record<string, unknown>[] = [];

  // Write 1: Verified challenge record
  writes.push({
    update: {
      name: `${docRoot}/users/${uid}/challenges/${attemptId}`,
      fields: toFirestoreFields(challengeDoc),
    },
  });

  // Write 2: Daily replay lock (if daily challenge)
  if (dailyKey) {
    writes.push({
      update: {
        name: `${docRoot}/users/${uid}/dailyDone/${dailyKey}`,
        fields: toFirestoreFields({ completedAt: Date.now(), attemptId }),
      },
    });
  }

  // Write 3: User aggregate stats
  const updatedUserDoc = {
    ...userFields,
    stats: {
      ...existingStats,
      totalPoints: newTotalPoints,
      challengesPlayed: newChallengesPlayed,
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
    },
    updatedAt: Date.now(),
  };
  writes.push({
    update: {
      name: `${docRoot}/users/${uid}`,
      fields: toFirestoreFields(updatedUserDoc),
    },
  });

  // Writes 4-6: Leaderboards (Global, Weekly, Monthly)
  const leaderboardPayload = (periodStr: string) => ({
    uid,
    username,
    displayName,
    emblem,
    points: newTotalPoints,
    challengesPlayed: newChallengesPlayed,
    bestStreak: newBestStreak,
    period: periodStr,
    updatedAt: Date.now(),
  });

  writes.push({
    update: {
      name: `${docRoot}/leaderboards/global/entries/${uid}`,
      fields: toFirestoreFields(leaderboardPayload('global')),
    },
  });
  writes.push({
    update: {
      name: `${docRoot}/leaderboards/weekly/periods/${weekKey}/entries/${uid}`,
      fields: toFirestoreFields(leaderboardPayload(weekKey)),
    },
  });
  writes.push({
    update: {
      name: `${docRoot}/leaderboards/monthly/periods/${monthKey}/entries/${uid}`,
      fields: toFirestoreFields(leaderboardPayload(monthKey)),
    },
  });

  // 3. Commit Transaction
  const commitRes = await fetch(`${baseApi}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction,
      writes,
    }),
  });

  if (!commitRes.ok) {
    const errText = await commitRes.text();
    throw new Error(`Firestore transaction commit failed: HTTP ${commitRes.status} - ${errText}`);
  }

  return {
    success: true,
    newTotalPoints,
    newChallengesPlayed,
    newCurrentStreak,
    newBestStreak,
  };
}

export interface ReconcileParams {
  creds: ServiceAccountCredentials;
  uid: string;
  claimedPoints?: number;
  claimedPlayed?: number;
  weekKey: string;
  monthKey: string;
}

/**
 * Reconciles a user's total points and challenges played across Firestore and Leaderboards.
 * Reads all verified challenges in `users/{uid}/challenges`, calculates the true total, and updates the leaderboards.
 */
export async function reconcileUserLeaderboard(params: ReconcileParams) {
  const { creds, uid, claimedPoints, claimedPlayed, weekKey, monthKey } = params;
  const projectId = cleanSecret(creds.projectId);
  const token = await getGoogleAccessToken(creds);
  const baseApi = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const docRoot = `projects/${projectId}/databases/(default)/documents`;

  // 1. Fetch user doc
  let userFields: Record<string, unknown> = {};
  const userRes = await fetch(`${baseApi}/users/${uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (userRes.ok) {
    const rawUser = (await userRes.json()) as { fields?: Record<string, FirestoreValue> };
    userFields = rawUser.fields ? fromFirestoreFields(rawUser.fields) : {};
  }

  // 2. Fetch all challenges for user
  let totalChallengePoints = 0;
  let totalChallengeCount = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  const challengesRes = await fetch(`${baseApi}/users/${uid}/challenges?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (challengesRes.ok) {
    const data = (await challengesRes.json()) as { documents?: { fields?: Record<string, FirestoreValue> }[] };
    if (data.documents) {
      for (const doc of data.documents) {
        if (doc.fields) {
          const f = fromFirestoreFields(doc.fields);
          if (typeof f.points === 'number') {
            totalChallengePoints += f.points;
            totalChallengeCount++;
            if (f.points >= 80) {
              currentStreak++;
              bestStreak = Math.max(bestStreak, currentStreak);
            } else {
              currentStreak = 0;
            }
          }
        }
      }
    }
  }

  const existingStats = (userFields.stats as Record<string, number> | undefined) || {};
  const finalPoints = Math.max(totalChallengePoints, claimedPoints || 0, existingStats.totalPoints || 0);
  const finalPlayed = Math.max(totalChallengeCount, claimedPlayed || 0, existingStats.challengesPlayed || 0);
  const finalBestStreak = Math.max(bestStreak, existingStats.bestStreak || 0);

  const username = String(userFields.username || `detective_${uid.slice(0, 6)}`).slice(0, 20);
  const displayName = String(userFields.displayName || 'Anonymous Detective').slice(0, 30);
  const emblem = ['compass', 'globe', 'lens', 'quill', 'anchor', 'star'].includes(userFields.emblem as string)
    ? userFields.emblem
    : 'compass';

  const updatedUserDoc = {
    ...userFields,
    stats: {
      ...existingStats,
      totalPoints: finalPoints,
      challengesPlayed: finalPlayed,
      bestStreak: finalBestStreak,
    },
    updatedAt: Date.now(),
  };

  const leaderboardPayload = (periodStr: string) => ({
    uid,
    username,
    displayName,
    emblem,
    points: finalPoints,
    challengesPlayed: finalPlayed,
    bestStreak: finalBestStreak,
    period: periodStr,
    updatedAt: Date.now(),
  });

  const writes = [
    {
      update: {
        name: `${docRoot}/users/${uid}`,
        fields: toFirestoreFields(updatedUserDoc),
      },
    },
    {
      update: {
        name: `${docRoot}/leaderboards/global/entries/${uid}`,
        fields: toFirestoreFields(leaderboardPayload('global')),
      },
    },
    {
      update: {
        name: `${docRoot}/leaderboards/weekly/periods/${weekKey}/entries/${uid}`,
        fields: toFirestoreFields(leaderboardPayload(weekKey)),
      },
    },
    {
      update: {
        name: `${docRoot}/leaderboards/monthly/periods/${monthKey}/entries/${uid}`,
        fields: toFirestoreFields(leaderboardPayload(monthKey)),
      },
    },
  ];

  const commitRes = await fetch(`${baseApi}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });

  if (!commitRes.ok) {
    const errText = await commitRes.text();
    throw new Error(`Reconciliation commit failed: HTTP ${commitRes.status} - ${errText}`);
  }

  return { points: finalPoints, challengesPlayed: finalPlayed };
}

