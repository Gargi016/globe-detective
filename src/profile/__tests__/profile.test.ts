import { describe, expect, it } from 'vitest';
import { newProgress, recordResult, saveProgress } from '../../challenge/progress';
import type { ChallengeResult, ProgressState, SafeStorage } from '../../challenge/progress';
import { newInvestigation } from '../../detective/investigation';
import { evaluateAchievements, unlockNew, ACHIEVEMENTS } from '../achievements';
import {
  cleanName, clearRunLog, DEFAULT_NAME, forgetSeenYears, INVESTIGATION_LOG_LIMIT, loadProfile, newProfile, parseProfile,
  PROFILE_KEY, recordYearViewed, removeRun, renameProfile, saveProfile, setEmblem, withInvestigationRun, withYearViewed,
} from '../profileStore';
import type { RunInput } from '../profileStore';
import { computeDashboard, rankFor } from '../stats';
import { syncAchievements } from '../sync';

class Mem implements SafeStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const run = (over: Partial<RunInput> = {}): RunInput => ({
  name: 'Case', clueCount: 3, status: 'ok', rangeText: '1971–1972', widthYears: 1, confidence: 'medium', labels: ['a'], investigation: newInvestigation('Case'), ...over,
});
const result = (over: Partial<ChallengeResult> = {}): ChallengeResult => ({
  id: 'x', seed: 'x', difficulty: 'medium', daily: null, refDate: '1965-07-01', intervalStart: '1964-03-01', intervalEnd: '1966-05-01',
  startYear: 1964, endYear: 1966, guess: 1965, distance: 0, base: 100, penalty: 0, points: 100, hintsUsed: 0, playedAt: 1, ...over,
});
const play = (s: ProgressState, n: number, over: Partial<ChallengeResult> = {}) => {
  for (let i = 0; i < n; i++) s = recordResult(s, result({ id: `r${s.stats.played}-${i}`, ...over }));
  return s;
};
const ctx = (profile = newProfile(), challenge = newProgress()) => ({ profile, challenge });
const unlocked = (c: ReturnType<typeof ctx>, id: string) => evaluateAchievements(c).find((a) => a.def.id === id)!.unlocked;

describe('profile store', () => {
  it('round-trips and survives corrupt or hostile storage', () => {
    const store = new Mem();
    expect(loadProfile(store).name).toBe(DEFAULT_NAME);
    const p = withInvestigationRun(renameProfile(newProfile(), '  Ada <b> '), run());
    expect(saveProfile(store, p)).toBe(true);
    const back = loadProfile(store);
    expect(back.name).toBe('Ada b');
    expect(back.log).toHaveLength(1);
    store.setItem(PROFILE_KEY, '{not json');
    expect(loadProfile(store).runs).toBe(0);
    store.setItem(PROFILE_KEY, JSON.stringify({ version: 1, name: 5, emblem: 'nope', exploredYears: [1950, 'x', 1950, 5], log: [{ id: 1 }], unlocked: { a: 'z', b: 3 } }));
    const q = loadProfile(store);
    expect(q).toMatchObject({ name: DEFAULT_NAME, emblem: 'compass', exploredYears: [1950], log: [], unlocked: { b: 3 } });
    expect(parseProfile({ version: 2 })).toBeNull();
    expect(loadProfile(null).runs).toBe(0);
  });

  it('cleans names', () => {
    expect(cleanName('a'.repeat(50))).toHaveLength(30);
    expect(renameProfile(newProfile(), '   ').name).toBe(DEFAULT_NAME);
    expect(setEmblem(newProfile(), 'globe').emblem).toBe('globe');
  });

  it('counts runs, narrow and contradictory runs, caps the log, and can remove entries', () => {
    let p = newProfile();
    p = withInvestigationRun(p, run({ at: 1, id: 'a' }));
    p = withInvestigationRun(p, run({ at: 2, id: 'b', clueCount: 2 }));
    p = withInvestigationRun(p, run({ at: 3, id: 'c', status: 'contradictory', widthYears: null }));
    expect(p).toMatchObject({ runs: 3, narrowRuns: 1, contradictoryRuns: 1 });
    expect(p.log.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(removeRun(p, 'b').log.map((r) => r.id)).toEqual(['c', 'a']);
    expect(clearRunLog(p).log).toEqual([]);
    expect(clearRunLog(p).runs).toBe(3);
    for (let i = 0; i < INVESTIGATION_LOG_LIMIT + 5; i++) p = withInvestigationRun(p, run({ at: 10 + i, id: `n${i}` }));
    expect(p.log).toHaveLength(INVESTIGATION_LOG_LIMIT);
  });

  it('tracks distinct covered years only', () => {
    const p = newProfile();
    expect(withYearViewed(p, 1950).exploredYears).toEqual([1950]);
    expect(withYearViewed(p, 1800)).toBe(p);
    expect(withYearViewed(p, 2020)).toBe(p);
    const q = withYearViewed(p, 1950);
    expect(withYearViewed(q, 1950)).toBe(q);
    const store = new Mem();
    forgetSeenYears();
    expect(recordYearViewed(store, 1960)).toBe(true);
    expect(recordYearViewed(store, 1960)).toBe(false);
    expect(loadProfile(store).exploredYears).toEqual([1960]);
  });
});

describe('achievements', () => {
  it('has unique ids and includes the six required badges', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const titles = ACHIEVEMENTS.map((a) => a.title);
    for (const t of ['First Investigation', 'History Explorer', 'Border Detective', 'Perfect Guess', 'Seven-Day Streak', 'Geography Expert']) expect(titles).toContain(t);
  });

  it('First Investigation, Border Detective', () => {
    expect(unlocked(ctx(), 'first-investigation')).toBe(false);
    let p = withInvestigationRun(newProfile(), run({ clueCount: 2, widthYears: 1 }));
    expect(unlocked(ctx(p), 'first-investigation')).toBe(true);
    expect(unlocked(ctx(p), 'border-detective')).toBe(false); // only 2 clues
    p = withInvestigationRun(p, run({ clueCount: 3, widthYears: 6 }));
    expect(unlocked(ctx(p), 'border-detective')).toBe(false); // too wide
    p = withInvestigationRun(p, run({ clueCount: 3, widthYears: 5 }));
    expect(unlocked(ctx(p), 'border-detective')).toBe(true);
  });

  it('History Explorer needs 25 distinct years', () => {
    let p = newProfile();
    for (let y = 1900; y < 1924; y++) p = withYearViewed(p, y);
    expect(unlocked(ctx(p), 'history-explorer')).toBe(false);
    p = withYearViewed(p, 1930);
    expect(unlocked(ctx(p), 'history-explorer')).toBe(true);
  });

  it('Perfect Guess, Geography Expert and thousand points', () => {
    expect(unlocked(ctx(newProfile(), play(newProgress(), 1, { points: 95 })), 'perfect-guess')).toBe(false);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 1, { points: 100 })), 'perfect-guess')).toBe(true);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 9, { points: 100 })), 'geography-expert')).toBe(false);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 10, { points: 80, distance: 3, base: 80 })), 'geography-expert')).toBe(true);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 10, { points: 60, distance: 8, base: 60 })), 'geography-expert')).toBe(false);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 10, { points: 100 })), 'thousand-points')).toBe(true);
  });

  it('Seven-Day Streak follows consecutive daily challenges', () => {
    let s = newProgress();
    for (let d = 1; d <= 6; d++) s = recordResult(s, result({ id: `d${d}`, daily: `2026-10-0${d}` }));
    expect(unlocked(ctx(newProfile(), s), 'seven-day-streak')).toBe(false);
    s = recordResult(s, result({ id: 'd7', daily: '2026-10-07' }));
    expect(unlocked(ctx(newProfile(), s), 'seven-day-streak')).toBe(true);
  });

  it('hard, unaided and sharp-eye badges', () => {
    expect(unlocked(ctx(newProfile(), play(newProgress(), 1, { difficulty: 'hard', points: 80 })), 'hard-boiled')).toBe(true);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 1, { difficulty: 'easy', points: 100 })), 'hard-boiled')).toBe(false);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 5, { hintsUsed: 1 })), 'no-hints')).toBe(false);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 5)), 'no-hints')).toBe(true);
    expect(unlocked(ctx(newProfile(), play(newProgress(), 5)), 'sharp-streak')).toBe(true);
  });

  it('a badge stays earned and keeps its date once stamped', () => {
    const c = ctx(newProfile(), play(newProgress(), 1));
    const first = unlockNew(c, 111);
    expect(first.added.map((a) => a.id).sort()).toEqual(['first-challenge', 'perfect-guess']);
    expect(first.profile.unlocked['perfect-guess']).toBe(111);
    const again = unlockNew({ profile: first.profile, challenge: newProgress() }, 222); // history erased
    expect(again.added).toEqual([]);
    expect(again.profile.unlocked['perfect-guess']).toBe(111);
    expect(unlocked({ profile: first.profile, challenge: newProgress() }, 'perfect-guess')).toBe(true);
  });
});

describe('stats', () => {
  it('ranks by points with progress to the next', () => {
    expect(rankFor(0).rank.title).toBe('Apprentice');
    expect(rankFor(250)).toMatchObject({ rank: { title: 'Cartographer’s Assistant' }, next: { title: 'Field Investigator' } });
    expect(rankFor(250).fraction).toBeCloseTo(0.5);
    expect(rankFor(99999)).toMatchObject({ next: null, fraction: 1 });
  });

  it('computes the dashboard from real history, with no division by zero when empty', () => {
    const empty = computeDashboard(newProgress(), newProfile(), '2026-11-02');
    expect(empty).toMatchObject({ completed: 0, accuracy: 0, withinFivePct: null, meanErrorYears: null, bestScore: 0, sample: 0 });
    let s = newProgress();
    s = recordResult(s, result({ id: 'a', points: 100, distance: 0 }));
    s = recordResult(s, result({ id: 'b', points: 60, distance: 8, base: 60, hintsUsed: 2, difficulty: 'hard' }));
    const d = computeDashboard(s, withInvestigationRun(newProfile(), run()), '2026-11-02');
    expect(d).toMatchObject({ totalPoints: 160, completed: 2, accuracy: 80, bestScore: 100, withinFivePct: 50, meanErrorYears: 4, hintsUsed: 2, investigations: 1, exactGuesses: 1 });
    expect(d.recent).toEqual([100, 60]);
    expect(d.byDifficulty.find((x) => x.difficulty === 'hard')).toMatchObject({ played: 1, average: 60, best: 60 });
    expect(d.tiers.reduce((t, x) => t + x.count, 0)).toBe(2);
  });
});

describe('sync', () => {
  it('stamps badges once and reports them only the first time', () => {
    const store = new Mem();
    saveProfile(store, withInvestigationRun(newProfile(), run()));
    saveProgress(store, play(newProgress(), 1));
    const first = syncAchievements(store, 5).map((a) => a.id).sort();
    expect(first).toEqual(['border-detective', 'first-challenge', 'first-investigation', 'perfect-guess']);
    expect(syncAchievements(store, 6)).toEqual([]);
    expect(loadProfile(store).unlocked['first-investigation']).toBe(5);
  });
});
