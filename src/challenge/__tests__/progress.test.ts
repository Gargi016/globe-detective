import { describe, expect, it } from 'vitest';
import {
  averagePoints, effectiveDailyStreak, HISTORY_LIMIT, loadProgress, localDateKey, newProgress, parseProgress, previousDayKey,
  PROGRESS_KEY, recordResult, resetProgress, saveProgress, STREAK_MIN_POINTS,
} from '../progress';
import type { ChallengeResult, SafeStorage } from '../progress';

const result = (over: Partial<ChallengeResult> = {}): ChallengeResult => ({
  id: 'medium:x', seed: 'x', difficulty: 'medium', daily: null, refDate: '1965-07-01', intervalStart: '1964-03-01', intervalEnd: '1966-05-01',
  startYear: 1964, endYear: 1966, guess: 1965, distance: 0, base: 100, penalty: 0, points: 100, hintsUsed: 0, playedAt: 1, ...over,
});

class Mem implements SafeStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('dates', () => {
  it('formats local day keys and steps back over month and year ends', () => {
    expect(localDateKey(new Date(2026, 10, 1))).toBe('2026-11-01');
    expect(previousDayKey('2026-11-01')).toBe('2026-10-31');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
    expect(previousDayKey('2024-03-01')).toBe('2024-02-29');
  });
});

describe('recording results', () => {
  it('updates history, totals, best and exact count', () => {
    let s = recordResult(newProgress(), result({ points: 100, distance: 0 }));
    s = recordResult(s, result({ id: 'b', points: 60, distance: 8, base: 60 }));
    expect(s.history.map((r) => r.id)).toEqual(['b', 'medium:x']);
    expect(s.stats).toMatchObject({ played: 2, totalPoints: 160, bestPoints: 100, exact: 1 });
    expect(averagePoints(s.stats)).toBe(80);
  });

  it('streak counts consecutive results of at least 80 points and resets on a worse one', () => {
    let s = newProgress();
    for (const pts of [100, 95, 80]) s = recordResult(s, result({ id: `r${pts}`, points: pts }));
    expect(s.stats.streak).toEqual({ current: 3, best: 3 });
    s = recordResult(s, result({ id: 'bad', points: STREAK_MIN_POINTS - 20, base: 60 }));
    expect(s.stats.streak).toEqual({ current: 0, best: 3 });
    s = recordResult(s, result({ id: 'again', points: 95 }));
    expect(s.stats.streak).toEqual({ current: 1, best: 3 });
  });

  it('daily streak grows on consecutive days, restarts after a gap, and counts a day once', () => {
    let s = recordResult(newProgress(), result({ id: 'd1', daily: '2026-10-29' }));
    s = recordResult(s, result({ id: 'd2', daily: '2026-10-30' }));
    s = recordResult(s, result({ id: 'd3', daily: '2026-10-31' }));
    expect(s.stats.daily).toMatchObject({ current: 3, best: 3, lastDate: '2026-10-31' });
    const dup = recordResult(s, result({ id: 'dup', daily: '2026-10-31' }));
    expect(dup.stats.played).toBe(3);
    expect(dup.dailyDone['2026-10-31']).toBe('d3');
    s = recordResult(s, result({ id: 'd5', daily: '2026-11-02' })); // skipped the 1st
    expect(s.stats.daily).toMatchObject({ current: 1, best: 3 });
  });

  it('the displayed daily streak is zero once a day has been missed', () => {
    const s = recordResult(newProgress(), result({ daily: '2026-10-30' }));
    expect(effectiveDailyStreak(s.stats, '2026-10-30')).toBe(1);
    expect(effectiveDailyStreak(s.stats, '2026-10-31')).toBe(1);
    expect(effectiveDailyStreak(s.stats, '2026-11-01')).toBe(0);
  });

  it('keeps only the most recent results but keeps counting totals', () => {
    let s = newProgress();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = recordResult(s, result({ id: `r${i}`, points: 10, base: 10, distance: 30 }));
    expect(s.history).toHaveLength(HISTORY_LIMIT);
    expect(s.stats.played).toBe(HISTORY_LIMIT + 5);
    expect(s.history[0].id).toBe(`r${HISTORY_LIMIT + 4}`);
  });

  it('finishing a challenge clears the active one', () => {
    const base = { ...newProgress(), active: { seed: 's', difficulty: 'easy' as const, daily: null, hintsUsed: 1, guessText: '19', startedAt: 1 } };
    expect(recordResult(base, result()).active).toBeNull();
  });
});

describe('persistence', () => {
  it('round-trips', () => {
    const store = new Mem();
    let s = recordResult(newProgress(), result({ daily: '2026-10-31' }));
    s = { ...s, difficulty: 'hard', active: { seed: 'abc', difficulty: 'hard', daily: null, hintsUsed: 2, guessText: '19', startedAt: 5 } };
    expect(saveProgress(store, s)).toBe(true);
    expect(loadProgress(store)).toEqual(s);
  });

  it('drops invalid entries and tolerates corruption', () => {
    const store = new Mem();
    store.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, history: [result(), { id: 'x' }, 7, { ...result(), points: 250 }], stats: { played: 'many' }, difficulty: 'impossible', active: { seed: 1 } }));
    const s = loadProgress(store);
    expect(s.history).toHaveLength(1);
    expect(s.stats.played).toBe(1);
    expect(s.difficulty).toBe('medium');
    expect(s.active).toBeNull();
    store.setItem(PROGRESS_KEY, '{oops');
    expect(loadProgress(store)).toEqual(newProgress());
    expect(loadProgress(null)).toEqual(newProgress());
    expect(parseProgress({ version: 2 })).toBeNull();
  });

  it('reports failure to save instead of pretending', () => {
    const broken: SafeStorage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    expect(saveProgress(broken, newProgress())).toBe(false);
    expect(saveProgress(null, newProgress())).toBe(false);
  });

  it('reset keeps the chosen difficulty only', () => {
    const s = resetProgress({ ...recordResult(newProgress(), result()), difficulty: 'hard' });
    expect(s).toEqual({ ...newProgress(), difficulty: 'hard' });
  });
});
