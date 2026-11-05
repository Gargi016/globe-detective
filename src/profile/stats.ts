import type { Difficulty } from '../challenge/generator';
import { DIFFICULTY_ORDER } from '../challenge/generator';
import { effectiveDailyStreak } from '../challenge/progress';
import type { ProgressState } from '../challenge/progress';
import { SCORE_TIERS, tierFor } from '../challenge/scoring';
import type { ProfileData } from './profileStore';

export interface Rank {
  title: string;
  from: number;
}

export const RANKS: readonly Rank[] = [
  { title: 'Apprentice', from: 0 },
  { title: 'Cartographer’s Assistant', from: 100 },
  { title: 'Field Investigator', from: 400 },
  { title: 'Senior Detective', from: 1000 },
  { title: 'Chief Cartographer', from: 2500 },
  { title: 'Keeper of the Archive', from: 5000 },
];

export function rankFor(points: number): { rank: Rank; next: Rank | null; fraction: number } {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (points >= RANKS[k].from) i = k;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  return { rank, next, fraction: next ? (points - rank.from) / (next.from - rank.from) : 1 };
}

export interface DifficultyStats {
  difficulty: Difficulty;
  played: number;
  average: number;
  best: number;
}

export interface Dashboard {
  totalPoints: number;
  completed: number;
  /** Average points per challenge, 0–100. Read as a percentage: 100 means every guess was exact. */
  accuracy: number;
  /** Share of recent challenges within five years of the answer. */
  withinFivePct: number | null;
  /** Mean distance from the answer in years over the recent history. */
  meanErrorYears: number | null;
  bestScore: number;
  currentStreak: number;
  bestStreak: number;
  dailyStreak: number;
  bestDailyStreak: number;
  exactGuesses: number;
  hintsUsed: number;
  byDifficulty: DifficultyStats[];
  /** Counts per scoring tier, recent history, in tier order. */
  tiers: { label: string; points: number; count: number }[];
  /** Points of the last 20 challenges, oldest first. */
  recent: number[];
  /** How many results the recent-history figures are based on. */
  sample: number;
  investigations: number;
  contradictions: number;
  yearsExplored: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeDashboard(progress: ProgressState, profile: ProfileData, today: string): Dashboard {
  const s = progress.stats;
  const h = progress.history;
  const within = h.filter((r) => r.distance <= 5).length;
  return {
    totalPoints: s.totalPoints,
    completed: s.played,
    accuracy: s.played === 0 ? 0 : round1(s.totalPoints / s.played),
    withinFivePct: h.length === 0 ? null : Math.round((within / h.length) * 100),
    meanErrorYears: h.length === 0 ? null : round1(h.reduce((t, r) => t + r.distance, 0) / h.length),
    bestScore: s.bestPoints,
    currentStreak: s.streak.current,
    bestStreak: s.streak.best,
    dailyStreak: effectiveDailyStreak(s, today),
    bestDailyStreak: s.daily.best,
    exactGuesses: s.exact,
    hintsUsed: h.reduce((t, r) => t + r.hintsUsed, 0),
    byDifficulty: DIFFICULTY_ORDER.map((d) => {
      const rows = h.filter((r) => r.difficulty === d);
      return { difficulty: d, played: rows.length, average: rows.length ? round1(rows.reduce((t, r) => t + r.points, 0) / rows.length) : 0, best: rows.reduce((m, r) => Math.max(m, r.points), 0) };
    }),
    tiers: SCORE_TIERS.map((t) => ({ label: t.label, points: t.points, count: h.filter((r) => tierFor(r.distance).points === t.points).length })),
    recent: h.slice(0, 20).map((r) => r.points).reverse(),
    sample: h.length,
    investigations: profile.runs,
    contradictions: profile.contradictoryRuns,
    yearsExplored: profile.exploredYears.length,
  };
}
