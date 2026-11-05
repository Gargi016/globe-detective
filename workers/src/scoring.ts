export interface YearInterval {
  startYear: number;
  endYear: number;
}

export interface ScoreTier {
  maxDistance: number;
  points: number;
  label: string;
}

export const SCORE_TIERS: readonly ScoreTier[] = [
  { maxDistance: 0, points: 100, label: 'Exact' },
  { maxDistance: 1, points: 95, label: '1 year off' },
  { maxDistance: 5, points: 80, label: '2–5 years off' },
  { maxDistance: 10, points: 60, label: '6–10 years off' },
  { maxDistance: 20, points: 30, label: '11–20 years off' },
  { maxDistance: Number.POSITIVE_INFINITY, points: 10, label: 'More than 20 years off' },
];

export const HINT_PENALTY_POINTS = 0;

export function distanceFromInterval(guess: number, interval: YearInterval): number {
  if (guess < interval.startYear) return interval.startYear - guess;
  if (guess > interval.endYear) return guess - interval.endYear;
  return 0;
}

export function tierFor(distance: number): ScoreTier {
  const d = Math.max(0, Math.round(distance));
  return SCORE_TIERS.find((t) => d <= t.maxDistance) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

export function calculateScore(guess: number, interval: YearInterval, hintsUsed = 0) {
  const distance = distanceFromInterval(guess, interval);
  const tier = tierFor(distance);
  const penalty = Math.max(0, Math.round(hintsUsed)) * HINT_PENALTY_POINTS;
  const points = Math.max(0, tier.points - penalty);
  return { distance, tier, penalty, points, base: tier.points };
}

export function getWeeklyPeriodKey(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

export function getMonthlyPeriodKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
