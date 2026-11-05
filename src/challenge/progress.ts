import { browserStorage } from '../detective/investigation';
import type { SafeStorage } from '../detective/investigation';
import { DIFFICULTY_ORDER } from './generator';
import type { Difficulty } from './generator';

export { browserStorage };
export type { SafeStorage };

/** A streak counts consecutive challenges scored at or above this many points (within five years). */
export const STREAK_MIN_POINTS = 80;
export const HISTORY_LIMIT = 100;
export const PROGRESS_KEY = 'globe-detective:challenge:v1';

export interface ChallengeResult {
  id: string;
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
}

export interface ActiveChallenge {
  seed: string;
  difficulty: Difficulty;
  daily: string | null;
  hintsUsed: number;
  guessText: string;
  startedAt: number;
}

export interface Streak {
  current: number;
  best: number;
}

export interface Stats {
  played: number;
  totalPoints: number;
  bestPoints: number;
  exact: number;
  streak: Streak;
  daily: Streak & { lastDate: string | null };
}

export interface ProgressState {
  version: 1;
  history: ChallengeResult[];
  active: ActiveChallenge | null;
  /** date key → id of the result for that day's daily challenge */
  dailyDone: Record<string, string>;
  stats: Stats;
  difficulty: Difficulty;
}

export function newProgress(): ProgressState {
  return {
    version: 1,
    history: [],
    active: null,
    dailyDone: {},
    stats: { played: 0, totalPoints: 0, bestPoints: 0, exact: 0, streak: { current: 0, best: 0 }, daily: { current: 0, best: 0, lastDate: null } },
    difficulty: 'medium',
  };
}

// ---------- dates --------------------------------------------------------------------------------

/** Local calendar day as yyyy-mm-dd: the daily challenge changes at the player's midnight. */
export function localDateKey(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(2000, m - 1, d - 1));
  t.setUTCFullYear(y, m - 1, d - 1);
  return `${String(t.getUTCFullYear()).padStart(4, '0')}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// ---------- recording ----------------------------------------------------------------------------

/** Adds a finished challenge: history, totals, streaks and the daily record. Pure: returns a new state. */
export function recordResult(state: ProgressState, result: ChallengeResult): ProgressState {
  const s = state.stats;
  const good = result.points >= STREAK_MIN_POINTS;
  const streakCurrent = good ? s.streak.current + 1 : 0;

  let daily = s.daily;
  let dailyDone = state.dailyDone;
  if (result.daily) {
    if (state.dailyDone[result.daily]) {
      // Already counted for that day: keep the first result.
      return { ...state, active: null };
    }
    dailyDone = { ...state.dailyDone, [result.daily]: result.id };
    const continues = daily.lastDate === previousDayKey(result.daily);
    const current = continues ? daily.current + 1 : 1;
    daily = { current, best: Math.max(daily.best, current), lastDate: result.daily };
  }

  return {
    ...state,
    active: null,
    dailyDone,
    history: [result, ...state.history].slice(0, HISTORY_LIMIT),
    stats: {
      played: s.played + 1,
      totalPoints: s.totalPoints + result.points,
      bestPoints: Math.max(s.bestPoints, result.points),
      exact: s.exact + (result.distance === 0 ? 1 : 0),
      streak: { current: streakCurrent, best: Math.max(s.streak.best, streakCurrent) },
      daily,
    },
  };
}

/** The daily streak as it stands today: broken if yesterday was missed. */
export function effectiveDailyStreak(stats: Stats, today: string): number {
  const last = stats.daily.lastDate;
  if (last === today || last === previousDayKey(today)) return stats.daily.current;
  return 0;
}

export function averagePoints(stats: Stats): number {
  return stats.played === 0 ? 0 : Math.round((stats.totalPoints / stats.played) * 10) / 10;
}

// ---------- persistence --------------------------------------------------------------------------

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDifficulty = (x: unknown): x is Difficulty => DIFFICULTY_ORDER.includes(x as Difficulty);
const int = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : null;
const isoDate = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

function parseResult(x: unknown): ChallengeResult | null {
  if (!isRecord(x)) return null;
  const guess = int(x.guess, 1000, 3000);
  const distance = int(x.distance);
  const base = int(x.base, 0, 100);
  const penalty = int(x.penalty, 0, 100);
  const points = int(x.points, 0, 100);
  const hintsUsed = int(x.hintsUsed, 0, 10);
  const startYear = int(x.startYear, 1000, 3000);
  const endYear = int(x.endYear, 1000, 3000);
  const playedAt = typeof x.playedAt === 'number' && Number.isFinite(x.playedAt) ? x.playedAt : null;
  if (
    typeof x.id !== 'string' || typeof x.seed !== 'string' || !isDifficulty(x.difficulty) ||
    !isoDate(x.refDate) || !isoDate(x.intervalStart) || !isoDate(x.intervalEnd) ||
    guess === null || distance === null || base === null || penalty === null || points === null ||
    hintsUsed === null || startYear === null || endYear === null || playedAt === null
  ) return null;
  return {
    id: x.id, seed: x.seed, difficulty: x.difficulty, daily: isoDate(x.daily) ? x.daily : null,
    refDate: x.refDate, intervalStart: x.intervalStart, intervalEnd: x.intervalEnd, startYear, endYear,
    guess, distance, base, penalty, points, hintsUsed, playedAt,
  };
}

function parseStreak(x: unknown): Streak {
  return isRecord(x) ? { current: int(x.current) ?? 0, best: int(x.best) ?? 0 } : { current: 0, best: 0 };
}

/** Validates untrusted stored data; anything unusable is dropped and the rest is kept. */
export function parseProgress(raw: unknown): ProgressState | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const base = newProgress();
  const history = (Array.isArray(raw.history) ? raw.history : []).map(parseResult).filter((r): r is ChallengeResult => r !== null).slice(0, HISTORY_LIMIT);
  const st = isRecord(raw.stats) ? raw.stats : {};
  const daily = isRecord(st.daily) ? st.daily : {};
  const streak = parseStreak(st.streak);
  const dailyStreak = parseStreak(daily);
  let active: ActiveChallenge | null = null;
  if (isRecord(raw.active) && typeof raw.active.seed === 'string' && isDifficulty(raw.active.difficulty)) {
    active = {
      seed: raw.active.seed.slice(0, 64),
      difficulty: raw.active.difficulty,
      daily: isoDate(raw.active.daily) ? raw.active.daily : null,
      hintsUsed: int(raw.active.hintsUsed, 0, 10) ?? 0,
      guessText: typeof raw.active.guessText === 'string' ? raw.active.guessText.slice(0, 6) : '',
      startedAt: typeof raw.active.startedAt === 'number' ? raw.active.startedAt : Date.now(),
    };
  }
  const dailyDone: Record<string, string> = {};
  if (isRecord(raw.dailyDone)) for (const [k, v] of Object.entries(raw.dailyDone)) if (isoDate(k) && typeof v === 'string') dailyDone[k] = v;
  return {
    version: 1,
    history,
    active,
    dailyDone,
    difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : base.difficulty,
    stats: {
      played: int(st.played) ?? history.length,
      totalPoints: int(st.totalPoints) ?? history.reduce((s, r) => s + r.points, 0),
      bestPoints: int(st.bestPoints, 0, 100) ?? 0,
      exact: int(st.exact) ?? 0,
      streak: { current: streak.current, best: Math.max(streak.best, streak.current) },
      daily: { current: dailyStreak.current, best: Math.max(dailyStreak.best, dailyStreak.current), lastDate: isoDate(daily.lastDate) ? daily.lastDate : null },
    },
  };
}

export function loadProgress(store: SafeStorage | null): ProgressState {
  try {
    const text = store?.getItem(PROGRESS_KEY);
    if (text) return parseProgress(JSON.parse(text)) ?? newProgress();
  } catch {
    /* corrupt storage behaves as empty */
  }
  return newProgress();
}

export function saveProgress(store: SafeStorage | null, state: ProgressState): boolean {
  if (!store) return false;
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Wipes score history, streaks and daily records. Keeps the chosen difficulty. */
export function resetProgress(state: ProgressState): ProgressState {
  return { ...newProgress(), difficulty: state.difficulty };
}
