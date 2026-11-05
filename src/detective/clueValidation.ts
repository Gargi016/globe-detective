import { EVENT_CATEGORIES } from './types';
import type { Clue, Conflict, DateRange, HistoricalEvent } from './types';
import { gapDaysBetween, intersectAll, isEmpty, isValidIsoDate, normalize, toDay } from './dateRange';
import { getEvent } from './historicalEvents';

/**
 * Validation for single clues, for sets of clues (duplicates, redundancy, contradiction) and for the event
 * database itself.
 */

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

const rangeProblems = (ranges: DateRange[] | undefined, what: string): string[] => {
  const out: string[] = [];
  if (!ranges) return out;
  for (const r of ranges) {
    if (r.start !== null && !isValidIsoDate(r.start)) out.push(`${what}: invalid start date "${r.start}"`);
    if (r.end !== null && !isValidIsoDate(r.end)) out.push(`${what}: invalid end date "${r.end}"`);
    if (r.start && r.end && isValidIsoDate(r.start) && isValidIsoDate(r.end) && r.start > r.end) {
      out.push(`${what}: start ${r.start} is after end ${r.end}`);
    }
  }
  return out;
};

/** Structural checks on one clue. A clue with problems is excluded from an estimate and reported. */
export function validateClue(clue: Clue): ValidationResult {
  const problems: string[] = [];
  if (!clue.id) problems.push('clue has no id');
  if (!clue.label) problems.push('clue has no label');
  if (clue.observation !== 'shows' && clue.observation !== 'absent') problems.push(`unknown observation "${String(clue.observation)}"`);
  if (!(clue.reliability >= 0 && clue.reliability <= 1)) problems.push(`reliability ${clue.reliability} is outside 0–1`);
  problems.push(...rangeProblems(clue.contentRanges, 'content range'));
  problems.push(...rangeProblems(clue.manufactureRanges, 'manufacture range'));
  if (clue.contentRanges.length === 0 && !clue.manufactureRanges?.length) problems.push('clue constrains nothing');
  else if (problems.length === 0 && clue.contentRanges.length > 0 && isEmpty(clue.contentRanges)) problems.push('clue content range is empty');
  if (clue.kind === 'event') {
    if (!clue.eventId) problems.push('event clue has no eventId');
    else if (!getEvent(clue.eventId)) problems.push(`unknown event "${clue.eventId}"`);
  }
  return { ok: problems.length === 0, problems };
}

// ---------- sets of clues -------------------------------------------------------------------------

export interface SetIssue {
  kind: 'duplicate' | 'opposite' | 'redundant' | 'exclusive-group';
  clueIds: string[];
  message: string;
}

/** Non-fatal observations about a set of clues (duplicates, redundancy, direct opposites). */
export function inspectClueSet(clues: Clue[]): SetIssue[] {
  const issues: SetIssue[] = [];
  const seen = new Map<string, Clue>();
  for (const c of clues) {
    if (seen.has(c.id)) issues.push({ kind: 'duplicate', clueIds: [c.id], message: `“${c.label}” was entered more than once; it is counted once.` });
    else seen.set(c.id, c);
  }
  const unique = [...seen.values()];

  for (const c of unique) {
    if (c.kind !== 'event' || c.observation !== 'shows' || !c.eventId) continue;
    const opposite = seen.get(`absent:${c.eventId}`);
    if (opposite) {
      issues.push({
        kind: 'opposite',
        clueIds: [c.id, opposite.id],
        message: `“${c.label}” cannot be both seen on the globe and missing from it.`,
      });
    }
  }

  // Two different depictions of one thing (old name and new name) can only both be right for a transition.
  const byGroup = new Map<string, Clue[]>();
  for (const c of unique) {
    const e = c.eventId ? getEvent(c.eventId) : undefined;
    if (!e?.group || c.observation !== 'shows') continue;
    byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), c]);
  }
  for (const [group, members] of byGroup) {
    if (members.length < 2) continue;
    const all = intersectAll(members.map((m) => m.contentRanges));
    if (isEmpty(all)) {
      issues.push({
        kind: 'exclusive-group',
        clueIds: members.map((m) => m.id),
        message: `These describe the same thing (${group.replace(/-/g, ' ')}) under different names or forms that were not in use at the same time.`,
      });
    }
  }

  // A clue whose ranges already contain the intersection of all the others adds nothing.
  if (unique.length > 1) {
    for (const c of unique) {
      const others = unique.filter((o) => o.id !== c.id);
      const rest = intersectAll(others.map((o) => o.contentRanges));
      if (isEmpty(rest)) continue;
      const withC = intersectAll([rest, c.contentRanges]);
      if (JSON.stringify(withC) === JSON.stringify(normalize(rest))) {
        issues.push({ kind: 'redundant', clueIds: [c.id], message: `“${c.label}” adds nothing: the other clues already imply it.` });
      }
    }
  }
  return issues;
}

// ---------- contradictions ------------------------------------------------------------------------

const intersectsAll = (clues: Clue[]) => !isEmpty(intersectAll(clues.map((c) => c.contentRanges)));

/** Max subset size searched exhaustively and max clue count for the exhaustive search. */
const EXHAUSTIVE_MAX_SIZE = 4;
const EXHAUSTIVE_MAX_CLUES = 20;

const EXPLANATIONS = {
  misread: 'A label may have been misread or matched to the wrong state: check the globe again.',
  mixed: 'The globe may combine map content of different dates, for example a globe updated in places or assembled from older plates.',
  approximate: 'One of the dates is approximate or gradual in reality (marked as such in the database), so the two may overlap in practice.',
  absence: 'Absence is weak evidence: a state or name may be missing for reasons of size or space rather than date.',
  informal: 'A name may have been in informal use, or kept by a publisher, after its official period.',
};

function explain(clues: Clue[], gapDays: number | null): string[] {
  const out = [EXPLANATIONS.misread];
  if (clues.some((c) => c.isAbsence)) out.push(EXPLANATIONS.absence);
  if (clues.some((c) => c.quality === 'approximate')) out.push(EXPLANATIONS.approximate);
  if (gapDays !== null && gapDays <= 5 * 366) out.push(EXPLANATIONS.mixed);
  out.push(EXPLANATIONS.informal);
  return out;
}

function describeGap(a: Clue, b: Clue, gapDays: number | null): string {
  if (gapDays === null) return `“${a.label}” and “${b.label}” cannot both hold.`;
  const years = gapDays / 365.2425;
  const gap = years < 1 ? `${Math.max(gapDays, 0)} days` : `about ${years.toFixed(years < 10 ? 1 : 0)} years`;
  return `“${a.label}” and “${b.label}” point to periods about ${gap} apart; no date satisfies both.`;
}

/**
 * Finds minimal sets of clues that cannot all be true together (up to 4 clues each when there are at most 20
 * clues; larger inputs are reduced to a single minimal core). Empty when the clues are consistent.
 */
export function findConflicts(clues: Clue[]): Conflict[] {
  const unique = dedupe(clues);
  if (intersectsAll(unique)) return [];
  const conflicts: Conflict[] = [];
  const found: Set<string>[] = [];
  const isSuperset = (ids: string[]) => found.some((f) => [...f].every((id) => ids.includes(id)));

  if (unique.length <= EXHAUSTIVE_MAX_CLUES) {
    for (let size = 2; size <= Math.min(EXHAUSTIVE_MAX_SIZE, unique.length); size++) {
      for (const combo of combinations(unique, size)) {
        const ids = combo.map((c) => c.id);
        if (isSuperset(ids)) continue;
        if (!intersectsAll(combo)) {
          found.push(new Set(ids));
          conflicts.push(toConflict(combo));
        }
      }
    }
  }
  if (conflicts.length === 0) {
    // Fallback: deletion-based minimisation to one minimal core.
    let core = unique;
    for (const c of [...unique]) {
      const without = core.filter((x) => x.id !== c.id);
      if (without.length > 0 && !intersectsAll(without)) core = without;
    }
    conflicts.push(toConflict(core));
  }
  return conflicts;
}

function toConflict(members: Clue[]): Conflict {
  let gapDays: number | null = null;
  let message: string;
  if (members.length === 2) {
    gapDays = gapDaysBetween(members[0].contentRanges, members[1].contentRanges);
    message = describeGap(members[0], members[1], gapDays);
  } else {
    message = `These ${members.length} clues cannot all be true together: ${members.map((m) => `“${m.label}”`).join(', ')}. Any two of them can be consistent, but not all at once.`;
  }
  return { clueIds: members.map((m) => m.id), message, gapDays, possibleExplanations: explain(members, gapDays) };
}

function* combinations<T>(items: T[], size: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i++) {
    yield* combinations(items, size, i + 1, [...prefix, items[i]]);
  }
}

export function dedupe(clues: Clue[]): Clue[] {
  const seen = new Set<string>();
  return clues.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/**
 * Maximal subsets of clues that are mutually consistent, each as the clue ids kept. Computed only over the
 * clues involved in some conflict; clues outside every conflict are always kept. Capped to keep it cheap.
 */
export function maximalConsistentSubsets(clues: Clue[], conflicts: Conflict[], limit = 6): string[][] {
  const unique = dedupe(clues);
  const involved = [...new Set(conflicts.flatMap((c) => c.clueIds))];
  const fixed = unique.filter((c) => !involved.includes(c.id));
  const variable = involved.map((id) => unique.find((c) => c.id === id)!).filter(Boolean);
  const k = Math.min(variable.length, 12);
  const pool = variable.slice(0, k);
  const consistent: string[][] = [];
  // Search subsets from large to small; keep the maximal ones.
  for (let size = pool.length; size >= 1 && consistent.length < limit * 4; size--) {
    for (const combo of combinations(pool, size)) {
      const ids = combo.map((c) => c.id);
      if (consistent.some((m) => ids.every((id) => m.includes(id)))) continue;
      if (intersectsAll([...fixed, ...combo])) consistent.push(ids);
    }
  }
  return consistent
    .slice(0, limit)
    .map((ids) => [...fixed.map((c) => c.id), ...ids]);
}

// ---------- the event database --------------------------------------------------------------------

/** Integrity checks over the event database, run by the unit tests. */
export function validateEventDatabase(events: readonly HistoricalEvent[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const groups = new Map<string, HistoricalEvent[]>();
  for (const e of events) {
    const at = `event "${e.id}"`;
    if (ids.has(e.id)) problems.push(`${at}: duplicate id`);
    ids.add(e.id);
    if (!EVENT_CATEGORIES.includes(e.category)) problems.push(`${at}: unknown category "${e.category}"`);
    if (!e.title || !e.description || !e.subject) problems.push(`${at}: missing title, description or subject`);
    if (e.valid.length === 0) problems.push(`${at}: no valid periods`);
    problems.push(...rangeProblems(e.valid, at));
    if (!isValidIsoDate(e.eventDate)) problems.push(`${at}: invalid eventDate "${e.eventDate}"`);
    if (e.aliases.length === 0) problems.push(`${at}: no aliases`);
    if (e.aliases.some((a) => a !== a.toLowerCase())) problems.push(`${at}: aliases must be lower-case`);
    if (e.sources.length === 0) problems.push(`${at}: no sources`);
    for (const s of e.sources) if (!/^https:\/\//.test(s.url)) problems.push(`${at}: source URL is not https: ${s.url}`);
    // Periods must be sorted and must not overlap.
    const valid = normalize(e.valid);
    if (valid.length !== e.valid.length) problems.push(`${at}: valid periods overlap or touch; merge them`);
    // Open start must be explained.
    if (e.valid.some((r) => r.start === null) && !e.openStartNote) problems.push(`${at}: open start without openStartNote`);
    // eventDate should fall on or next to a bound of a period.
    const nearBound = e.valid.some((r) => [r.start, r.end].some((b) => b !== null && Math.abs(toDay(b) - toDay(e.eventDate)) <= 1));
    const inside = e.valid.some((r) => (r.start === null || r.start <= e.eventDate) && (r.end === null || e.eventDate <= r.end));
    if (!nearBound && !inside) problems.push(`${at}: eventDate ${e.eventDate} is not at or within its valid periods`);
    if (e.group) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  }
  return problems;
}
