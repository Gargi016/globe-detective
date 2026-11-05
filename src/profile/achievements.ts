import type { ProgressState } from '../challenge/progress';
import type { ProfileData } from './profileStore';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  glyph: string;
  /** Group for display. */
  group: 'Investigating' | 'Exploring' | 'Challenges' | 'Streaks';
  /** Progress towards the badge. `done` is the unlock test; `current`/`target` feed the progress bar. */
  evaluate: (ctx: Context) => { current: number; target: number; done: boolean; note?: string };
}

export interface Context {
  profile: ProfileData;
  challenge: ProgressState;
}

const ratio = (current: number, target: number, done?: boolean) => ({ current: Math.min(current, target), target, done: done ?? current >= target });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-investigation',
    title: 'First Investigation',
    description: 'Run the date estimator on a case file for the first time.',
    glyph: '◎',
    group: 'Investigating',
    evaluate: ({ profile }) => ratio(profile.runs, 1),
  },
  {
    id: 'border-detective',
    title: 'Border Detective',
    description: 'Narrow a globe to five years or fewer using at least three clues.',
    glyph: '⌖',
    group: 'Investigating',
    evaluate: ({ profile }) => ratio(profile.narrowRuns, 1),
  },
  {
    id: 'contradiction-spotter',
    title: 'Contradiction Spotter',
    description: 'Run an estimate that exposes clues that cannot all be true.',
    glyph: '⚠',
    group: 'Investigating',
    evaluate: ({ profile }) => ratio(profile.contradictoryRuns, 1),
  },
  {
    id: 'history-explorer',
    title: 'History Explorer',
    description: 'Look at 25 different years on the reference globe.',
    glyph: '◍',
    group: 'Exploring',
    evaluate: ({ profile }) => ratio(profile.exploredYears.length, 25),
  },
  {
    id: 'first-challenge',
    title: 'Case Opened',
    description: 'Complete your first challenge.',
    glyph: '✦',
    group: 'Challenges',
    evaluate: ({ challenge }) => ratio(challenge.stats.played, 1),
  },
  {
    id: 'perfect-guess',
    title: 'Perfect Guess',
    description: 'Score 100 points on a challenge.',
    glyph: '★',
    group: 'Challenges',
    evaluate: ({ challenge }) => ratio(challenge.stats.bestPoints, 100),
  },
  {
    id: 'geography-expert',
    title: 'Geography Expert',
    description: 'Average at least 80 points over ten or more challenges.',
    glyph: '♛',
    group: 'Challenges',
    evaluate: ({ challenge }) => {
      const { played, totalPoints } = challenge.stats;
      const avg = played === 0 ? 0 : totalPoints / played;
      const done = played >= 10 && avg >= 80;
      const progress = played < 10 ? played / 10 : Math.min(avg / 80, 1);
      return { current: Math.round(progress * 100), target: 100, done, note: `${played} played, average ${Math.round(avg * 10) / 10}` };
    },
  },
  {
    id: 'no-hints',
    title: 'Unaided',
    description: 'Score 80 or more without a hint on five challenges.',
    glyph: '☉',
    group: 'Challenges',
    evaluate: ({ challenge }) => ratio(challenge.history.filter((r) => r.hintsUsed === 0 && r.points >= 80).length, 5),
  },
  {
    id: 'hard-boiled',
    title: 'Hard-Boiled',
    description: 'Score 80 or more on a Hard challenge, where state names are hidden.',
    glyph: '⚔',
    group: 'Challenges',
    evaluate: ({ challenge }) => ratio(challenge.history.filter((r) => r.difficulty === 'hard' && r.points >= 80).length, 1),
  },
  {
    id: 'thousand-points',
    title: 'Thousand Points',
    description: 'Earn 1,000 points across all challenges.',
    glyph: '❖',
    group: 'Challenges',
    evaluate: ({ challenge }) => ratio(challenge.stats.totalPoints, 1000),
  },
  {
    id: 'seven-day-streak',
    title: 'Seven-Day Streak',
    description: 'Complete the daily challenge on seven days in a row.',
    glyph: '☀',
    group: 'Streaks',
    evaluate: ({ challenge }) => ratio(Math.max(challenge.stats.daily.best, challenge.stats.daily.current), 7),
  },
  {
    id: 'sharp-streak',
    title: 'Sharp Eye',
    description: 'Score 80 or more on five challenges in a row.',
    glyph: '➶',
    group: 'Streaks',
    evaluate: ({ challenge }) => ratio(Math.max(challenge.stats.streak.best, challenge.stats.streak.current), 5),
  },
];

export interface AchievementStatus {
  def: AchievementDef;
  unlocked: boolean;
  unlockedAt: number | null;
  current: number;
  target: number;
  note?: string;
}

export function evaluateAchievements(ctx: Context): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    const r = def.evaluate(ctx);
    const at = ctx.profile.unlocked[def.id] ?? null;
    // A badge, once earned, is kept even if the history it was earned from has since been trimmed.
    const unlocked = r.done || at !== null;
    return { def, unlocked, unlockedAt: at, current: unlocked ? r.target : r.current, target: r.target, note: r.note };
  });
}

/** Stamps newly earned badges with the time. Returns the updated profile and the badges that are new. */
export function unlockNew(ctx: Context, now = Date.now()): { profile: ProfileData; added: AchievementDef[] } {
  const added: AchievementDef[] = [];
  const unlocked = { ...ctx.profile.unlocked };
  for (const s of evaluateAchievements(ctx)) {
    if (s.unlocked && unlocked[s.def.id] === undefined) {
      unlocked[s.def.id] = now;
      added.push(s.def);
    }
  }
  return { profile: added.length ? { ...ctx.profile, unlocked } : ctx.profile, added };
}
