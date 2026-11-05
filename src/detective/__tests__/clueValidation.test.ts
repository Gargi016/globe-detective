import { describe, expect, it } from 'vitest';
import { createClue, createPrintedDateClue } from '../clues';
import { dedupe, findConflicts, inspectClueSet, maximalConsistentSubsets, validateClue, validateEventDatabase } from '../clueValidation';
import { HISTORICAL_EVENTS } from '../historicalEvents';
import type { HistoricalEvent } from '../types';

const shows = (id: string) => createClue(id, 'shows');

describe('validateClue', () => {
  it('accepts clues built from the database and printed dates', () => {
    expect(validateClue(shows('ussr-exists')).ok).toBe(true);
    expect(validateClue(createClue('ussr-exists', 'absent')).ok).toBe(true);
    expect(validateClue(createPrintedDateClue({ year: 1962 })).ok).toBe(true);
  });

  it('rejects malformed clues with specific problems', () => {
    const base = shows('ussr-exists');
    expect(validateClue({ ...base, contentRanges: [{ start: '1991-02-30', end: null }] }).problems.join()).toMatch(/invalid start/);
    expect(validateClue({ ...base, contentRanges: [{ start: '1991-01-02', end: '1991-01-01' }] }).problems.join()).toMatch(/after end/);
    expect(validateClue({ ...base, reliability: 1.5 }).problems.join()).toMatch(/outside 0–1/);
    expect(validateClue({ ...base, eventId: 'nope' }).problems.join()).toMatch(/unknown event/);
    expect(validateClue({ ...base, contentRanges: [] }).ok).toBe(false);
  });

  it('rejects an implausible printed year', () => {
    expect(() => createPrintedDateClue({ year: 12 })).toThrow();
    expect(() => createPrintedDateClue({ year: 1962.5 })).toThrow();
  });
});

describe('inspectClueSet', () => {
  it('flags duplicates, opposites, exclusive names and redundant clues', () => {
    const dup = inspectClueSet([shows('ceylon-name'), shows('ceylon-name')]);
    expect(dup.some((i) => i.kind === 'duplicate')).toBe(true);

    const opp = inspectClueSet([shows('ussr-exists'), createClue('ussr-exists', 'absent')]);
    expect(opp.some((i) => i.kind === 'opposite')).toBe(true);

    const names = inspectClueSet([shows('ceylon-name'), shows('sri-lanka-name')]);
    expect(names.some((i) => i.kind === 'exclusive-group')).toBe(true);

    const red = inspectClueSet([shows('bangladesh-independent'), shows('ussr-exists'), shows('east-germany-exists')]);
    expect(red.some((i) => i.kind === 'redundant' && i.clueIds[0] === 'shows:ussr-exists')).toBe(true);
  });

  it('reports nothing for a clean set', () => {
    expect(inspectClueSet([shows('bangladesh-independent'), shows('ceylon-name')])).toEqual([]);
  });
});

describe('findConflicts', () => {
  it('is empty when the clues agree', () => {
    expect(findConflicts([shows('ussr-exists'), shows('bangladesh-independent')])).toEqual([]);
  });

  it('finds minimal pairs and does not report supersets of them', () => {
    const c = findConflicts([shows('ceylon-name'), shows('myanmar-name'), shows('ussr-exists'), shows('bangladesh-independent')]);
    expect(c).toHaveLength(1);
    expect(c[0].clueIds.sort()).toEqual(['shows:ceylon-name', 'shows:myanmar-name']);
  });

  it('finds a three-clue conflict where every pair is consistent', () => {
    // Union ranges make pairwise tests insufficient: Siam (≤1939 or 1945-09-11..1949-05-10),
    // India/Pakistan (≥1947-08-14) and Thailand-after-1949 (≥1949-05-11) are pairwise compatible but not jointly.
    const c = findConflicts([shows('siam-name'), shows('india-pakistan-independent'), shows('thailand-name')]);
    const sets = c.map((x) => x.clueIds.sort().join('+'));
    expect(sets).toContain('shows:siam-name+shows:thailand-name');
  });

  it('dedupes', () => {
    expect(dedupe([shows('ussr-exists'), shows('ussr-exists')])).toHaveLength(1);
  });
});

describe('maximalConsistentSubsets', () => {
  it('keeps unrelated clues in every alternative', () => {
    const clues = [shows('ussr-exists'), shows('ceylon-name'), shows('sri-lanka-name')];
    const conflicts = findConflicts(clues);
    const subsets = maximalConsistentSubsets(clues, conflicts).map((s) => s.slice().sort());
    expect(subsets.length).toBe(2);
    for (const s of subsets) expect(s).toContain('shows:ussr-exists');
  });
});

describe('validateEventDatabase', () => {
  const good = HISTORICAL_EVENTS[0];
  const mutate = (patch: Partial<HistoricalEvent>) => validateEventDatabase([{ ...good, ...patch }]);

  it('detects duplicate ids', () => {
    expect(validateEventDatabase([good, good]).join()).toMatch(/duplicate id/);
  });
  it('detects bad dates and reversed periods', () => {
    expect(mutate({ valid: [{ start: '1991-12-26', end: '1922-12-30' }] }).join()).toMatch(/after end/);
    expect(mutate({ eventDate: '1991-13-01' }).join()).toMatch(/invalid eventDate/);
  });
  it('detects overlapping periods', () => {
    expect(mutate({ valid: [{ start: '1950-01-01', end: '1960-01-01' }, { start: '1955-01-01', end: '1965-01-01' }] }).join()).toMatch(/overlap/);
  });
  it('requires sources, https URLs and lower-case aliases', () => {
    expect(mutate({ sources: [] }).join()).toMatch(/no sources/);
    expect(mutate({ sources: [{ label: 'x', url: 'http://example.com' }] }).join()).toMatch(/not https/);
    expect(mutate({ aliases: ['USSR'] }).join()).toMatch(/lower-case/);
  });
  it('requires an explanation for an open start', () => {
    expect(mutate({ valid: [{ start: null, end: '1950-01-01' }], openStartNote: undefined, eventDate: '1950-01-01' }).join()).toMatch(/openStartNote/);
  });
});
