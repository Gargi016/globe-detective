import type { Investigation } from '../detective/investigation';
import { parseInvestigation } from '../detective/investigation';
import type { ConfidenceLevel } from '../detective/types';
import type { SafeStorage } from '../detective/investigation';

/**
 * The player's profile and activity log. Everything here is stored in this browser's LocalStorage only: it is
 * a personal record, not a shared one. Nothing is sent anywhere, and no figure here is comparable with anyone
 * else's. (A real multi-user leaderboard would need a backend and a database.)
 */

export const PROFILE_KEY = 'globe-detective:profile:v1';
export const INVESTIGATION_LOG_LIMIT = 100;
export const MAX_YEARS_TRACKED = 200;

export const EMBLEMS = [
  { id: 'compass', glyph: '✦', label: 'Compass rose' },
  { id: 'globe', glyph: '◍', label: 'Globe' },
  { id: 'lens', glyph: '◎', label: 'Magnifier' },
  { id: 'quill', glyph: '✒', label: 'Quill' },
  { id: 'anchor', glyph: '⚓', label: 'Anchor' },
  { id: 'star', glyph: '★', label: 'Star' },
] as const;
export type EmblemId = (typeof EMBLEMS)[number]['id'];

export interface InvestigationRecord {
  id: string;
  at: number;
  name: string;
  clueCount: number;
  status: 'ok' | 'contradictory';
  /** e.g. "1971–1972" or "no estimate". */
  rangeText: string;
  widthYears: number | null;
  confidence: ConfidenceLevel;
  /** A few clue labels for the list. */
  labels: string[];
  /** The case file as it was, so it can be reopened in Detective Mode. */
  investigation: Investigation;
}

export interface ProfileData {
  version: 1;
  name: string;
  emblem: EmblemId;
  createdAt: number;
  /** Distinct calendar years looked at on a reference globe. */
  exploredYears: number[];
  /** Counters kept separately because the log below is capped. */
  runs: number;
  contradictoryRuns: number;
  /** Runs with at least three clues that narrowed the map content to five years or less. */
  narrowRuns: number;
  log: InvestigationRecord[];
  /** achievement id → time it was unlocked */
  unlocked: Record<string, number>;
}

export const DEFAULT_NAME = 'Anonymous Detective';

export function newProfile(now = Date.now()): ProfileData {
  return { version: 1, name: DEFAULT_NAME, emblem: 'compass', createdAt: now, exploredYears: [], runs: 0, contradictoryRuns: 0, narrowRuns: 0, log: [], unlocked: {} };
}

// ---------- validation ---------------------------------------------------------------------------

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown): number => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 1e9 ? x : 0);
const LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low', 'none'];

export function cleanName(text: string): string {
  return text.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

function parseRecord(x: unknown): InvestigationRecord | null {
  if (!isRecord(x) || typeof x.id !== 'string' || typeof x.at !== 'number') return null;
  const inv = parseInvestigation(x.investigation);
  if (!inv) return null;
  return {
    id: x.id.slice(0, 40),
    at: x.at,
    name: typeof x.name === 'string' ? cleanName(x.name) || 'Untitled investigation' : 'Untitled investigation',
    clueCount: count(x.clueCount),
    status: x.status === 'contradictory' ? 'contradictory' : 'ok',
    rangeText: typeof x.rangeText === 'string' ? x.rangeText.slice(0, 60) : '',
    widthYears: typeof x.widthYears === 'number' && Number.isFinite(x.widthYears) ? x.widthYears : null,
    confidence: LEVELS.includes(x.confidence as ConfidenceLevel) ? (x.confidence as ConfidenceLevel) : 'none',
    labels: Array.isArray(x.labels) ? x.labels.filter((l): l is string => typeof l === 'string').slice(0, 6).map((l) => l.slice(0, 120)) : [],
    investigation: inv.investigation,
  };
}

/** Validates untrusted stored data and keeps whatever is usable. */
export function parseProfile(raw: unknown): ProfileData | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const base = newProfile();
  const years = (Array.isArray(raw.exploredYears) ? raw.exploredYears : [])
    .filter((y): y is number => typeof y === 'number' && Number.isInteger(y) && y >= 1000 && y <= 3000);
  const unlocked: Record<string, number> = {};
  if (isRecord(raw.unlocked)) for (const [k, v] of Object.entries(raw.unlocked)) if (typeof v === 'number' && Number.isFinite(v)) unlocked[k.slice(0, 40)] = v;
  const log = (Array.isArray(raw.log) ? raw.log : []).map(parseRecord).filter((r): r is InvestigationRecord => r !== null).slice(0, INVESTIGATION_LOG_LIMIT);
  return {
    version: 1,
    name: typeof raw.name === 'string' ? cleanName(raw.name) || DEFAULT_NAME : DEFAULT_NAME,
    emblem: EMBLEMS.some((e) => e.id === raw.emblem) ? (raw.emblem as EmblemId) : base.emblem,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : base.createdAt,
    exploredYears: [...new Set(years)].sort((a, b) => a - b).slice(0, MAX_YEARS_TRACKED),
    runs: Math.max(count(raw.runs), log.length),
    contradictoryRuns: count(raw.contradictoryRuns),
    narrowRuns: count(raw.narrowRuns),
    log,
    unlocked,
  };
}

// ---------- storage ------------------------------------------------------------------------------

export function loadProfile(store: SafeStorage | null): ProfileData {
  try {
    const text = store?.getItem(PROFILE_KEY);
    if (text) return parseProfile(JSON.parse(text)) ?? newProfile();
  } catch {
    /* corrupt storage behaves as empty */
  }
  return newProfile();
}

export function saveProfile(store: SafeStorage | null, p: ProfileData): boolean {
  if (!store) return false;
  try {
    store.setItem(PROFILE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

// ---------- updates (pure) -----------------------------------------------------------------------

export function renameProfile(p: ProfileData, name: string): ProfileData {
  return { ...p, name: cleanName(name) || DEFAULT_NAME };
}

export function setEmblem(p: ProfileData, emblem: EmblemId): ProfileData {
  return EMBLEMS.some((e) => e.id === emblem) ? { ...p, emblem } : p;
}

/** Remembers that a year was looked at. Returns the same object when nothing changed. */
export function withYearViewed(p: ProfileData, year: number): ProfileData {
  if (!Number.isInteger(year) || year < 1886 || year > 2019 || p.exploredYears.includes(year)) return p;
  return { ...p, exploredYears: [...p.exploredYears, year].sort((a, b) => a - b) };
}

export type RunInput = Omit<InvestigationRecord, 'id' | 'at'> & { at?: number; id?: string };

/** Records one run of the estimator. */
export function withInvestigationRun(p: ProfileData, input: RunInput): ProfileData {
  const record: InvestigationRecord = { ...input, id: input.id ?? `i${(input.at ?? Date.now()).toString(36)}${p.runs.toString(36)}`, at: input.at ?? Date.now() };
  const narrow = input.status === 'ok' && input.clueCount >= 3 && input.widthYears !== null && input.widthYears <= 5;
  return {
    ...p,
    runs: p.runs + 1,
    contradictoryRuns: p.contradictoryRuns + (input.status === 'contradictory' ? 1 : 0),
    narrowRuns: p.narrowRuns + (narrow ? 1 : 0),
    log: [record, ...p.log].slice(0, INVESTIGATION_LOG_LIMIT),
  };
}

export function removeRun(p: ProfileData, id: string): ProfileData {
  return { ...p, log: p.log.filter((r) => r.id !== id) };
}

export function clearRunLog(p: ProfileData): ProfileData {
  return { ...p, log: [] };
}

// ---------- convenience for pages ----------------------------------------------------------------

/** Years already written this session, so scrubbing a slider does not rewrite storage for years seen before. */
const seenYears = new Set<number>();

export function recordYearViewed(store: SafeStorage | null, year: number): boolean {
  if (seenYears.has(year)) return false;
  const p = loadProfile(store);
  seenYears.add(year);
  const next = withYearViewed(p, year);
  if (next === p) return false;
  return saveProfile(store, next);
}

export function recordInvestigationRun(store: SafeStorage | null, input: RunInput): boolean {
  return saveProfile(store, withInvestigationRun(loadProfile(store), input));
}

/** For tests. */
export function forgetSeenYears(): void {
  seenYears.clear();
}
