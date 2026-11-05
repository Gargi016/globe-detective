import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { calculateScore, distanceFromInterval, getMonthlyPeriodKey, getWeeklyPeriodKey, tierFor } from '../src/scoring';
import { fromFirestoreFields, toFirestoreFields } from '../src/firestore';

const mockEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test-sa@test-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
};

describe('Cloudflare Worker edge handler', () => {
  it('responds to OPTIONS preflight with CORS headers and status 204', async () => {
    const req = new Request('https://api.globedetective.com/api/challenge/submit', {
      method: 'OPTIONS',
    });
    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('responds to GET /api/health with status 200 and ok payload', async () => {
    const req = new Request('https://api.globedetective.com/api/health', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('globe-detective-worker');
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const req = new Request('https://api.globedetective.com/api/challenge/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: 1950 }),
    });
    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorization header/i);
  });

  it('rejects invalid or malformed Bearer tokens with HTTP 401', async () => {
    const req = new Request('https://api.globedetective.com/api/challenge/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.jwt.token',
      },
      body: JSON.stringify({ guess: 1950 }),
    });
    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authentication failed/i);
  });
});

describe('Cloudflare Worker scoring math', () => {
  it('calculates exact interval distances', () => {
    const span = { startYear: 1961, endYear: 1965 };
    expect(distanceFromInterval(1961, span)).toBe(0);
    expect(distanceFromInterval(1963, span)).toBe(0);
    expect(distanceFromInterval(1965, span)).toBe(0);
    expect(distanceFromInterval(1960, span)).toBe(1);
    expect(distanceFromInterval(1970, span)).toBe(5);
  });

  it('computes verified points matching scoring tiers', () => {
    expect(tierFor(0).points).toBe(100);
    expect(tierFor(1).points).toBe(95);
    expect(tierFor(4).points).toBe(80);
    expect(tierFor(9).points).toBe(60);
    expect(tierFor(18).points).toBe(30);
    expect(tierFor(50).points).toBe(10);
  });

  it('calculateScore computes base, penalty, distance, and final points', () => {
    const scoreExact = calculateScore(1975, { startYear: 1974, endYear: 1976 }, 0);
    expect(scoreExact.points).toBe(100);
    expect(scoreExact.distance).toBe(0);

    const scoreOff = calculateScore(1970, { startYear: 1974, endYear: 1976 }, 2);
    expect(scoreOff.distance).toBe(4);
    expect(scoreOff.points).toBe(80);
  });

  it('generates consistent ISO week and month keys', () => {
    const d = new Date('2026-11-05T00:00:00Z');
    expect(getWeeklyPeriodKey(d)).toMatch(/^2026-W\d{2}$/);
    expect(getMonthlyPeriodKey(d)).toBe('2026-11');
  });
});

describe('Firestore REST field serialization & deserialization', () => {
  it('converts JavaScript objects into valid Firestore REST document format', () => {
    const input = {
      name: 'Sherlock',
      points: 100,
      verified: true,
      tags: ['history', 'cold-war'],
    };

    const fields = toFirestoreFields(input);
    expect(fields.name).toEqual({ stringValue: 'Sherlock' });
    expect(fields.points).toEqual({ integerValue: '100' });
    expect(fields.verified).toEqual({ booleanValue: true });
    expect(fields.tags).toEqual({
      arrayValue: {
        values: [{ stringValue: 'history' }, { stringValue: 'cold-war' }],
      },
    });
  });

  it('round-trips objects between JS and Firestore REST format cleanly', () => {
    const original = {
      title: 'Case 42',
      year: 1980,
      active: false,
    };

    const fields = toFirestoreFields(original);
    const restored = fromFirestoreFields(fields);
    expect(restored).toEqual(original);
  });
});
