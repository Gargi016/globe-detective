/**
 * Scoring for Challenge Mode.
 *
 * Points depend only on how far the guess is from the reference, measured in calendar years:
 *   exact 100 · 1 year 95 · 2–5 years 80 · 6–10 years 60 · 11–20 years 30 · more than 20 years 10.
 *
 * A mystery globe's reference is an INTERVAL (the span during which the map looks the same), not an invented
 * exact year, so the distance is measured from the interval: a guess inside it is exact, and a guess outside it
 * is as far as its nearest edge.
 */

export interface YearInterval {
  startYear: number;
  endYear: number;
}

export interface ScoreTier {
  /** Largest distance in years that earns this tier. */
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

/** Points deducted per hint. Zero by default: hints are free but are recorded. Raise it to make hints cost. */
export const HINT_PENALTY_POINTS = 0;

export const MIN_GUESS_YEAR = 1800;
export const MAX_GUESS_YEAR = 2100;

/** Whole years between a guess and the interval; 0 when the guess falls inside it. */
export function distanceFromInterval(guess: number, interval: YearInterval): number {
  if (guess < interval.startYear) return interval.startYear - guess;
  if (guess > interval.endYear) return guess - interval.endYear;
  return 0;
}

export function tierFor(distance: number): ScoreTier {
  const d = Math.max(0, Math.round(distance));
  return SCORE_TIERS.find((t) => d <= t.maxDistance) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

export function pointsForDistance(distance: number): number {
  return tierFor(distance).points;
}

export function parseGuess(text: string): { ok: true; year: number } | { ok: false; message: string } {
  const t = text.trim();
  if (!/^\d{4}$/.test(t)) return { ok: false, message: 'Enter a four-digit year, for example 1962.' };
  const year = Number(t);
  if (year < MIN_GUESS_YEAR || year > MAX_GUESS_YEAR) {
    return { ok: false, message: `Enter a year between ${MIN_GUESS_YEAR} and ${MAX_GUESS_YEAR}.` };
  }
  return { ok: true, year };
}

export interface GuessScore {
  guess: number;
  distance: number;
  inside: boolean;
  tier: ScoreTier;
  base: number;
  penalty: number;
  points: number;
}

export function scoreGuess(guess: number, interval: YearInterval, hintsUsed = 0): GuessScore {
  const distance = distanceFromInterval(guess, interval);
  const tier = tierFor(distance);
  const penalty = Math.max(0, Math.round(hintsUsed)) * HINT_PENALTY_POINTS;
  return { guess, distance, inside: distance === 0, tier, base: tier.points, penalty, points: Math.max(0, tier.points - penalty) };
}

/** Short wording for the result screen. */
export function describeResult(score: GuessScore, interval: YearInterval): string {
  const single = interval.startYear === interval.endYear;
  if (score.inside) {
    return single
      ? `Exactly right: the map matches ${interval.startYear}.`
      : `Inside the span: this map looks the same from ${interval.startYear} to ${interval.endYear}, so any guess in it is exact.`;
  }
  const dir = score.guess < interval.startYear ? 'earlier' : 'later';
  return `${score.distance} year${score.distance === 1 ? '' : 's'} ${dir} than the map’s ${single ? 'year' : 'span'}.`;
}
