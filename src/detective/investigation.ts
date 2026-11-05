import { clueFromEvent, clueId, createPrintedDateClue } from './clues';
import type { Certainty, PrintedDateMeaning } from './clues';
import { getEvent } from './historicalEvents';
import type { Anchor } from '../history/types';
import type { Clue, Estimate, Observation as ObservationKind } from './types';

/**
 * An investigation: the observations a person has gathered about one globe, plus the settings of the
 * estimate. Pure data and pure functions, so it can be saved, restored and tested without a browser.
 */

export interface InvestigationObservation {
  id: string;
  source: 'event' | 'printed';
  /** For `event` observations. */
  eventId?: string;
  observation: ObservationKind;
  certainty: Certainty;
  /** For `printed` observations. */
  printedYear?: number;
  printedMeaning?: PrintedDateMeaning;
  note?: string;
  addedAt: number;
}

export interface Investigation {
  version: 1;
  name: string;
  observations: InvestigationObservation[];
  reuseLagYears: number;
  /** Where the reference globe was left, so a restored investigation reopens in the same place. */
  viewYear: number;
  anchor: Anchor;
  explored: boolean;
}

export const INVESTIGATION_VERSION = 1;
export const DEFAULT_VIEW_YEAR = 1960;
export const MAX_OBSERVATIONS = 40;

export function newInvestigation(name = 'Untitled investigation'): Investigation {
  return { version: 1, name, observations: [], reuseLagYears: 10, viewYear: DEFAULT_VIEW_YEAR, anchor: 'start', explored: false };
}

let counter = 0;
const newId = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;

export const CERTAINTIES: Certainty[] = ['certain', 'probable', 'uncertain'];

// ---------- editing (all return new objects) -----------------------------------------------------

export type AddResult =
  | { status: 'added'; investigation: Investigation; observation: InvestigationObservation }
  | { status: 'duplicate' | 'unknown-event' | 'invalid' | 'full'; investigation: Investigation; message: string };

export function addEventObservation(
  inv: Investigation,
  eventId: string,
  observation: ObservationKind,
  certainty: Certainty = 'certain',
): AddResult {
  const event = getEvent(eventId);
  if (!event) return { status: 'unknown-event', investigation: inv, message: `Unknown event “${eventId}”.` };
  if (inv.observations.length >= MAX_OBSERVATIONS) {
    return { status: 'full', investigation: inv, message: `An investigation holds at most ${MAX_OBSERVATIONS} observations.` };
  }
  if (inv.observations.some((o) => o.source === 'event' && o.eventId === eventId && o.observation === observation)) {
    return { status: 'duplicate', investigation: inv, message: `“${event.subject}” is already in this investigation.` };
  }
  const obs: InvestigationObservation = { id: newId(), source: 'event', eventId, observation, certainty, addedAt: Date.now() };
  return { status: 'added', investigation: { ...inv, observations: [...inv.observations, obs] }, observation: obs };
}

export function addPrintedDate(
  inv: Investigation,
  year: number,
  meaning: PrintedDateMeaning = 'copyright',
  certainty: Certainty = 'certain',
): AddResult {
  if (!Number.isInteger(year) || year < 1400 || year > 9999) {
    return { status: 'invalid', investigation: inv, message: 'Enter a four-digit year between 1400 and 9999.' };
  }
  if (inv.observations.length >= MAX_OBSERVATIONS) {
    return { status: 'full', investigation: inv, message: `An investigation holds at most ${MAX_OBSERVATIONS} observations.` };
  }
  if (inv.observations.some((o) => o.source === 'printed' && o.printedYear === year && o.printedMeaning === meaning)) {
    return { status: 'duplicate', investigation: inv, message: `That printed date is already in this investigation.` };
  }
  const obs: InvestigationObservation = {
    id: newId(),
    source: 'printed',
    observation: 'shows',
    certainty,
    printedYear: year,
    printedMeaning: meaning,
    addedAt: Date.now(),
  };
  return { status: 'added', investigation: { ...inv, observations: [...inv.observations, obs] }, observation: obs };
}

export type ObservationPatch = Partial<Pick<InvestigationObservation, 'observation' | 'certainty' | 'note' | 'printedYear' | 'printedMeaning'>>;

/** Modify an observation. Changing seen/missing on a printed date is ignored; making it a duplicate is refused. */
export function updateObservation(inv: Investigation, id: string, patch: ObservationPatch): { investigation: Investigation; error?: string } {
  const target = inv.observations.find((o) => o.id === id);
  if (!target) return { investigation: inv, error: 'That observation no longer exists.' };
  const next: InvestigationObservation = { ...target, ...patch };
  if (target.source === 'printed') {
    next.observation = 'shows';
    if (!Number.isInteger(next.printedYear) || next.printedYear! < 1400 || next.printedYear! > 9999) {
      return { investigation: inv, error: 'Enter a four-digit year between 1400 and 9999.' };
    }
  }
  const clash = inv.observations.some(
    (o) =>
      o.id !== id &&
      o.source === next.source &&
      (next.source === 'event'
        ? o.eventId === next.eventId && o.observation === next.observation
        : o.printedYear === next.printedYear && o.printedMeaning === next.printedMeaning),
  );
  if (clash) return { investigation: inv, error: 'That would duplicate another observation.' };
  return { investigation: { ...inv, observations: inv.observations.map((o) => (o.id === id ? next : o)) } };
}

export function removeObservation(inv: Investigation, id: string): Investigation {
  return { ...inv, observations: inv.observations.filter((o) => o.id !== id) };
}

/** Keeps the name and the view; removes every observation. */
export function clearObservations(inv: Investigation): Investigation {
  return { ...inv, observations: [] };
}

// ---------- to the estimator ---------------------------------------------------------------------

export function observationToClue(o: InvestigationObservation): Clue | null {
  if (o.source === 'printed') {
    if (o.printedYear === undefined) return null;
    return createPrintedDateClue({ year: o.printedYear, meaning: o.printedMeaning, certainty: o.certainty });
  }
  const event = o.eventId ? getEvent(o.eventId) : undefined;
  return event ? clueFromEvent(event, o.observation, { certainty: o.certainty }) : null;
}

export function cluesOf(inv: Investigation): Clue[] {
  return inv.observations.map(observationToClue).filter((c): c is Clue => c !== null);
}

export function clueIdOf(o: InvestigationObservation): string | null {
  if (o.source === 'printed') return o.printedYear === undefined ? null : `printed:${o.printedMeaning ?? 'copyright'}:${o.printedYear}`;
  return o.eventId ? clueId(o.observation, o.eventId) : null;
}

// ---------- progress -----------------------------------------------------------------------------

export interface ProgressStep {
  id: 'explore' | 'observe' | 'corroborate' | 'estimate' | 'review';
  label: string;
  hint: string;
  done: boolean;
}

export interface ProgressState {
  /** Whether a result exists for the current observations (not stale). */
  estimateCurrent: boolean;
  estimate: Estimate | null;
}

export function progressOf(inv: Investigation, state: ProgressState): { steps: ProgressStep[]; done: number; fraction: number } {
  const n = inv.observations.length;
  const steps: ProgressStep[] = [
    { id: 'explore', label: 'Explore the globe', hint: 'Pick a year or click a state on the globe.', done: inv.explored || n > 0 },
    { id: 'observe', label: 'Record an observation', hint: 'Search an old name and add what your globe shows.', done: n >= 1 },
    { id: 'corroborate', label: 'Corroborate with a second clue', hint: 'Independent clues narrow the range and guard against error.', done: n >= 2 },
    { id: 'estimate', label: 'Run the estimate', hint: 'Combine the observations into a date range.', done: state.estimateCurrent },
    {
      id: 'review',
      label: 'Review the evidence',
      hint: 'Resolve any contradiction and check which clues decide the range.',
      done: state.estimateCurrent && state.estimate?.status === 'ok',
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, fraction: done / steps.length };
}

// ---------- persistence --------------------------------------------------------------------------

export const CURRENT_KEY = 'globe-detective:investigation:current:v1';
export const SAVES_KEY = 'globe-detective:investigation:saves:v1';

export interface SavedInvestigation {
  id: string;
  name: string;
  savedAt: number;
  investigation: Investigation;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Validates untrusted stored data. Anything unusable is dropped and counted, never trusted: observations with
 * unknown events or bad years disappear rather than breaking the estimator.
 */
export function parseInvestigation(raw: unknown): { investigation: Investigation; dropped: number } | null {
  if (!isRecord(raw) || raw.version !== INVESTIGATION_VERSION || !Array.isArray(raw.observations)) return null;
  const base = newInvestigation(typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 80) : undefined);
  let dropped = 0;
  const seen = new Set<string>();
  const observations: InvestigationObservation[] = [];
  for (const item of raw.observations) {
    if (!isRecord(item)) { dropped++; continue; }
    const certainty = CERTAINTIES.includes(item.certainty as Certainty) ? (item.certainty as Certainty) : 'certain';
    const note = typeof item.note === 'string' ? item.note.slice(0, 280) : undefined;
    const addedAt = typeof item.addedAt === 'number' && Number.isFinite(item.addedAt) ? item.addedAt : Date.now();
    let obs: InvestigationObservation | null = null;
    if (item.source === 'printed') {
      const year = item.printedYear;
      if (typeof year === 'number' && Number.isInteger(year) && year >= 1400 && year <= 9999) {
        const meaning: PrintedDateMeaning = item.printedMeaning === 'corrected-to' ? 'corrected-to' : 'copyright';
        obs = { id: newId(), source: 'printed', observation: 'shows', certainty, printedYear: year, printedMeaning: meaning, note, addedAt };
      }
    } else if (item.source === 'event' && typeof item.eventId === 'string' && getEvent(item.eventId)) {
      const kind: ObservationKind = item.observation === 'absent' ? 'absent' : 'shows';
      obs = { id: newId(), source: 'event', eventId: item.eventId, observation: kind, certainty, note, addedAt };
    }
    if (!obs) { dropped++; continue; }
    const key = obs.source === 'event' ? `e:${obs.eventId}:${obs.observation}` : `p:${obs.printedMeaning}:${obs.printedYear}`;
    if (seen.has(key) || observations.length >= MAX_OBSERVATIONS) { dropped++; continue; }
    seen.add(key);
    observations.push(obs);
  }
  const lag = typeof raw.reuseLagYears === 'number' && raw.reuseLagYears >= 0 && raw.reuseLagYears <= 100 ? Math.round(raw.reuseLagYears) : base.reuseLagYears;
  const year = typeof raw.viewYear === 'number' && Number.isInteger(raw.viewYear) && raw.viewYear >= 1000 && raw.viewYear <= 3000 ? raw.viewYear : base.viewYear;
  const anchor: Anchor = raw.anchor === 'mid' || raw.anchor === 'end' ? raw.anchor : 'start';
  return {
    investigation: { ...base, observations, reuseLagYears: lag, viewYear: year, anchor, explored: raw.explored === true },
    dropped,
  };
}

/** Storage access that never throws: private windows and blocked storage simply behave as empty. */
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): SafeStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__gd_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function readJson(store: SafeStorage | null, key: string): unknown {
  if (!store) return null;
  try {
    const text = store.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

function writeJson(store: SafeStorage | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadCurrent(store: SafeStorage | null): { investigation: Investigation; dropped: number } | null {
  return parseInvestigation(readJson(store, CURRENT_KEY));
}

export function saveCurrent(store: SafeStorage | null, inv: Investigation): boolean {
  return writeJson(store, CURRENT_KEY, inv);
}

export function clearCurrent(store: SafeStorage | null): void {
  try {
    store?.removeItem(CURRENT_KEY);
  } catch {
    /* ignore */
  }
}

export function listSaved(store: SafeStorage | null): SavedInvestigation[] {
  const raw = readJson(store, SAVES_KEY);
  if (!Array.isArray(raw)) return [];
  const out: SavedInvestigation[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.savedAt !== 'number') continue;
    const parsed = parseInvestigation(item.investigation);
    if (!parsed) continue;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.slice(0, 80) : parsed.investigation.name;
    out.push({ id: item.id, name, savedAt: item.savedAt, investigation: { ...parsed.investigation, name } });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** Saves under a name. An existing save with the same name (case-insensitive) is replaced. */
export function saveNamed(store: SafeStorage | null, name: string, inv: Investigation, now = Date.now()): { ok: boolean; saves: SavedInvestigation[]; error?: string } {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, saves: listSaved(store), error: 'Give the investigation a name to save it.' };
  const existing = listSaved(store);
  const same = existing.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  const entry: SavedInvestigation = { id: same?.id ?? `s${now.toString(36)}${(counter++).toString(36)}`, name: clean, savedAt: now, investigation: { ...inv, name: clean } };
  const next = [entry, ...existing.filter((s) => s.id !== entry.id)];
  const ok = writeJson(store, SAVES_KEY, next);
  return ok ? { ok, saves: next } : { ok, saves: existing, error: 'The browser would not store the investigation (storage is blocked or full).' };
}

export function deleteSaved(store: SafeStorage | null, id: string): SavedInvestigation[] {
  const next = listSaved(store).filter((s) => s.id !== id);
  writeJson(store, SAVES_KEY, next);
  return next;
}

// ---------- presets ------------------------------------------------------------------------------

export interface Preset {
  id: string;
  title: string;
  blurb: string;
  items: { eventId: string; observation: ObservationKind }[];
}

/** Starting points so the desk can be tried without already owning a globe. */
export const PRESETS: Preset[] = [
  {
    id: 'cold-war',
    title: 'A Cold War globe',
    blurb: 'Shows the USSR, East and West Germany and Ceylon.',
    items: [
      { eventId: 'ussr-exists', observation: 'shows' },
      { eventId: 'germany-divided', observation: 'shows' },
      { eventId: 'ceylon-name', observation: 'shows' },
    ],
  },
  {
    id: 'post-1971',
    title: 'Just after Bangladesh',
    blurb: 'Shows Bangladesh and Ceylon.',
    items: [
      { eventId: 'bangladesh-independent', observation: 'shows' },
      { eventId: 'ceylon-name', observation: 'shows' },
    ],
  },
  {
    id: 'contradiction',
    title: 'A suspicious globe',
    blurb: 'Shows Ceylon and Sri Lanka at once. See how contradictions are reported.',
    items: [
      { eventId: 'ceylon-name', observation: 'shows' },
      { eventId: 'sri-lanka-name', observation: 'shows' },
      { eventId: 'ussr-exists', observation: 'shows' },
    ],
  },
];

export function applyPreset(inv: Investigation, preset: Preset): Investigation {
  let next = clearObservations(inv);
  for (const item of preset.items) {
    const r = addEventObservation(next, item.eventId, item.observation);
    next = r.investigation;
  }
  return { ...next, name: preset.title, explored: true };
}
