import type { HistoryService } from '../history/historyService';
import type { Anchor } from '../history/types';
import { pick, rngFor } from './random';

/**
 * Challenge generation.
 *
 * Every challenge is a real moment from CShapes 2.0: a reference date (1 Jan, 1 Jul or 31 Dec of a year) whose
 * world map is drawn exactly as the dataset records it. The answer is never invented: it is the span of days
 * around that date during which the depicted map does not visibly change (see
 * `HistoryService.configurationSpan`), because several neighbouring years can show an identical map.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  blurb: string;
  /** Years the reference date is drawn from. */
  firstYear: number;
  lastYear: number;
  /** Calendar years touched by the answer span: wider is more forgiving. In the real data most maps last only one or two years. */
  minSpan: number;
  maxSpan: number;
  /** How many of the four hints can be opened. */
  maxHints: number;
  /** Whether state names appear on hover. When false they are hidden until the reveal. */
  showNames: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    blurb: 'The Cold War era, 1946–1995. The map must be stable for at least two years, so the answer is a span, not a single year. Four hints, names shown.',
    firstYear: 1946,
    lastYear: 1995,
    minSpan: 2,
    maxSpan: 15,
    maxHints: 4,
    showNames: true,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    blurb: 'The twentieth century, 1920–2005, empires and all. Answer spans of one to three years. Three hints, names shown.',
    firstYear: 1920,
    lastYear: 2005,
    minSpan: 1,
    maxSpan: 3,
    maxHints: 3,
    showNames: true,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    blurb: 'Any year from 1886 to 2019, and the map changes within the year, so only the exact year scores full points. Two hints; state names are hidden: read the borders.',
    firstYear: 1886,
    lastYear: 2019,
    minSpan: 1,
    maxSpan: 1,
    maxHints: 2,
    showNames: false,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export interface ChallengeInterval {
  start: string;
  end: string;
  startYear: number;
  endYear: number;
  /** Calendar years the span touches. */
  yearSpan: number;
}

export interface Challenge {
  id: string;
  seed: string;
  difficulty: Difficulty;
  /** Local calendar date key for the daily challenge, else null. */
  daily: string | null;
  year: number;
  anchor: Anchor;
  /** The date the drawn map depicts. Hidden from the player until they guess. */
  refDate: string;
  interval: ChallengeInterval;
  /** True when no date met the difficulty's span rule and the nearest was used. Never expected with the real data. */
  relaxed: boolean;
}

const ANCHORS: Anchor[] = ['start', 'mid', 'end'];

export function dailySeed(dateKey: string): string {
  return `daily:${dateKey}`;
}

export function challengeInterval(service: HistoryService, refDate: string): ChallengeInterval {
  const span = service.configurationSpan(refDate);
  const startYear = Number(span.start.slice(0, 4));
  const endYear = Number(span.end.slice(0, 4));
  return { ...span, startYear, endYear, yearSpan: endYear - startYear + 1 };
}

/** Deterministic: the same service data, seed and difficulty always give the same challenge. */
export function generateChallenge(service: HistoryService, seed: string, difficulty: Difficulty, daily: string | null = null): Challenge {
  const cfg = DIFFICULTIES[difficulty];
  const rng = rngFor(`${difficulty}|${seed}`);
  const first = Math.max(cfg.firstYear, service.meta.firstYear);
  const last = Math.min(cfg.lastYear, service.meta.lastYear);

  let best: { year: number; anchor: Anchor; refDate: string; interval: ChallengeInterval; miss: number } | null = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const year = first + Math.floor(rng() * (last - first + 1));
    const anchor = pick(rng, ANCHORS);
    const refDate = service.dateFor(year, anchor);
    const interval = challengeInterval(service, refDate);
    const miss = interval.yearSpan < cfg.minSpan ? cfg.minSpan - interval.yearSpan : interval.yearSpan > cfg.maxSpan ? interval.yearSpan - cfg.maxSpan : 0;
    if (miss === 0) {
      return { id: `${difficulty}:${seed}`, seed, difficulty, daily, year, anchor, refDate, interval, relaxed: false };
    }
    if (!best || miss < best.miss) best = { year, anchor, refDate, interval, miss };
  }
  // Practically unreachable with the real data, but never fail to produce a challenge.
  const b = best!;
  return { id: `${difficulty}:${seed}`, seed, difficulty, daily, year: b.year, anchor: b.anchor, refDate: b.refDate, interval: b.interval, relaxed: true };
}
