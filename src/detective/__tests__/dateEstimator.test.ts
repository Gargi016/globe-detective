import { describe, expect, it } from 'vitest';
import { createClue, createClues, createPrintedDateClue } from '../clues';
import { computeConfidence, estimateDate, widthScore, yearSpanText } from '../dateEstimator';
import { containsDate } from '../dateRange';
import type { Clue } from '../types';

const TODAY = '2026-11-01';
const est = (clues: Clue[], extra: Parameters<typeof estimateDate>[1] = {}) => estimateDate(clues, { today: TODAY, ...extra });
const shows = (id: string) => createClue(id, 'shows');
const absent = (id: string) => createClue(id, 'absent');

describe('the four examples from the brief', () => {
  it('USSR shown → content predates its dissolution in 1991', () => {
    const e = est([shows('ussr-exists')]);
    expect(e.status).toBe('ok');
    expect(e.information!.ranges).toEqual([{ start: '1922-12-30', end: '1991-12-26' }]);
  });

  it('Ceylon shown → a naming period before Sri Lanka replaced it in 1972', () => {
    const e = est([shows('ceylon-name')]);
    expect(e.information!.ranges).toHaveLength(1);
    expect(e.information!.ranges[0].end).toBe('1972-05-21');
    // No lower bound exists: the range starts at the earliest plausible date and says so.
    expect(e.caveats.join(' ')).toMatch(/Nothing bounds the date from below/);
  });

  it('East and West Germany shown → before reunification in 1990', () => {
    const e = est([shows('east-germany-exists'), shows('west-germany-exists')]);
    expect(e.information!.ranges).toEqual([{ start: '1949-10-07', end: '1990-10-02' }]);
  });

  it('Bangladesh shown → after independence in 1971', () => {
    const e = est([shows('bangladesh-independent')]);
    expect(e.information!.ranges).toEqual([{ start: '1971-03-26', end: TODAY }]);
    expect(e.caveats.join(' ')).toMatch(/Nothing bounds the date from above/);
  });
});

describe('combining clues', () => {
  it('returns the intersection of all ranges', () => {
    const e = est([shows('ussr-exists'), shows('ceylon-name'), shows('germany-divided'), shows('bangladesh-independent')]);
    expect(e.status).toBe('ok');
    expect(e.information!.ranges).toEqual([{ start: '1971-03-26', end: '1972-05-21' }]);
    expect(e.information!.text).toBe('26 Mar 1971 – 21 May 1972');
  });

  it('identifies the clues that actually set the bounds', () => {
    const e = est([shows('ussr-exists'), shows('ceylon-name'), shows('germany-divided'), shows('bangladesh-independent')]);
    expect(e.bindingClueIds.sort()).toEqual(['shows:bangladesh-independent', 'shows:ceylon-name'].sort());
  });

  it('counts a repeated clue once', () => {
    const e = est([shows('ceylon-name'), shows('ceylon-name')]);
    expect(e.reasoning).toHaveLength(1);
  });

  it('handles clues made of several periods (Siam/Thailand alternation)', () => {
    const e = est([shows('siam-name'), shows('india-pakistan-independent')]);
    expect(e.information!.ranges).toEqual([{ start: '1947-08-14', end: '1949-05-10' }]);
    const t = est([shows('thailand-name'), shows('ussr-exists')]);
    // Thailand 1939-06-24..1945-09-10 or 1949-05-11.., within USSR 1922-12-30..1991-12-26
    expect(t.information!.ranges).toEqual([
      { start: '1939-06-24', end: '1945-09-10' },
      { start: '1949-05-11', end: '1991-12-26' },
    ]);
  });

  it('narrow capital-name clues give very tight ranges', () => {
    const e = est([shows('nur-sultan-name')]);
    expect(e.information!.ranges).toEqual([{ start: '2019-03-23', end: '2022-09-16' }]);
  });

  it('every clue gets a reasoning step and the range never widens along the way', () => {
    const e = est([shows('ussr-exists'), shows('ceylon-name'), shows('bangladesh-independent')]);
    expect(e.reasoning.map((s) => s.clueId)).toEqual(['shows:ussr-exists', 'shows:ceylon-name', 'shows:bangladesh-independent']);
    expect(e.reasoning.every((s) => s.text.length > 40)).toBe(true);
    expect(e.reasoning[0].effect).toBe('sets-start');
    expect(e.reasoning.at(-1)!.rangeAfter).toEqual(e.information!.ranges);
  });

  it('a clue that adds nothing is reported as no-change', () => {
    const e = est([shows('bangladesh-independent'), shows('ceylon-name'), shows('ussr-exists')]);
    expect(e.reasoning.find((s) => s.clueId === 'shows:ussr-exists')!.effect).toBe('no-change');
  });
});

describe('absence clues', () => {
  it('do not show the USSR → either before 1922 or after 1991', () => {
    const e = est([absent('ussr-exists')]);
    expect(e.information!.ranges).toEqual([
      { start: '1492-01-01', end: '1922-12-29' },
      { start: '1991-12-27', end: TODAY },
    ]);
  });

  it('are weaker than the same fact seen', () => {
    expect(absent('ussr-exists').reliability).toBeLessThan(shows('ussr-exists').reliability);
    expect(absent('singapore-independent').reliability).toBeLessThan(absent('ussr-exists').reliability);
  });

  it('combine with presence clues: absent USSR + Bangladesh → after 1991', () => {
    const e = est([absent('ussr-exists'), shows('bangladesh-independent')]);
    expect(e.information!.ranges).toEqual([{ start: '1991-12-27', end: TODAY }]);
  });

  it('lower confidence than the same evidence from presence', () => {
    const present = est([shows('bangladesh-independent'), shows('ceylon-name')]);
    const missing = est([absent('bangladesh-independent'), absent('sri-lanka-name')]);
    expect(present.confidence.information.score).toBeGreaterThan(missing.confidence.information.score);
  });
});

describe('contradictions', () => {
  it('Ceylon with Sri Lanka cannot both hold', () => {
    const e = est([shows('ceylon-name'), shows('sri-lanka-name')]);
    expect(e.status).toBe('contradictory');
    expect(e.information).toBeNull();
    expect(e.manufactureLikely).toBeNull();
    expect(e.confidence.information.level).toBe('none');
    expect(e.conflicts).toHaveLength(1);
    expect(e.conflicts[0].clueIds.sort()).toEqual(['shows:ceylon-name', 'shows:sri-lanka-name']);
    expect(e.conflicts[0].message).toMatch(/no date satisfies both/);
    expect(e.conflicts[0].possibleExplanations.length).toBeGreaterThan(0);
  });

  it('reports the size of the gap between incompatible clues', () => {
    const e = est([shows('ceylon-name'), shows('zimbabwe-independent')]);
    expect(e.status).toBe('contradictory');
    // Ceylon ends 1972-05-21, Zimbabwe starts 1980-04-18
    expect(e.conflicts[0].gapDays).toBeGreaterThan(7 * 365);
    expect(e.conflicts[0].message).toMatch(/years apart/);
  });

  it('isolates the conflicting clues and leaves unrelated ones out of the conflict', () => {
    const e = est([shows('ussr-exists'), shows('ceylon-name'), shows('myanmar-name')]);
    expect(e.status).toBe('contradictory');
    expect(e.conflicts.map((c) => c.clueIds.sort())).toEqual([['shows:ceylon-name', 'shows:myanmar-name']]);
  });

  it('USSR and the Russian Federation touch but do not overlap', () => {
    const e = est([shows('ussr-exists'), shows('russia-federation')]);
    // The USSR is valid to 1991-12-26 and the Federation from 1991-12-26: they share that day, so no contradiction.
    expect(e.status).toBe('ok');
    expect(e.information!.ranges).toEqual([{ start: '1991-12-26', end: '1991-12-26' }]);
    // The very narrow result carries a low confidence, which is the honest outcome.
    expect(e.confidence.information.level).not.toBe('high');
    expect(e.confidence.information.factors.some((f) => f.id === 'knife-edge')).toBe(true);
    expect(e.caveats.join(' ')).toMatch(/only days or weeks wide/);
  });

  it('offers consistent alternatives that leave out some clues', () => {
    const e = est([shows('ussr-exists'), shows('ceylon-name'), shows('sri-lanka-name')]);
    expect(e.status).toBe('contradictory');
    const kept = e.alternatives.map((a) => a.keptClueIds.slice().sort().join('+'));
    expect(kept).toContain('shows:ceylon-name+shows:ussr-exists');
    expect(kept).toContain('shows:sri-lanka-name+shows:ussr-exists');
    expect(kept).not.toContain('shows:ceylon-name+shows:sri-lanka-name+shows:ussr-exists');
    for (const alt of e.alternatives) expect(alt.information.ranges.length).toBeGreaterThan(0);
  });

  it('a seen-and-missing pair is a contradiction', () => {
    const e = est([shows('ussr-exists'), absent('ussr-exists')]);
    expect(e.status).toBe('contradictory');
  });

  it('Siam and Thailand names alternate, so they conflict', () => {
    expect(est([shows('siam-name'), shows('thailand-name')]).status).toBe('contradictory');
  });
});

describe('publication date versus manufacture date', () => {
  it('likely manufacture equals the content window; possible extends it by the reuse lag', () => {
    const e = est([shows('ussr-exists')]);
    expect(e.information!.ranges).toEqual([{ start: '1922-12-30', end: '1991-12-26' }]);
    expect(e.manufactureLikely!.ranges).toEqual([{ start: '1922-12-30', end: '1991-12-26' }]);
    expect(e.manufacturePossible!.ranges).toEqual([{ start: '1922-12-30', end: '2001-12-26' }]);
  });

  it('the reuse lag is an explicit, adjustable assumption', () => {
    const e = est([shows('ussr-exists')], { reuseLagYears: 20 });
    expect(e.assumptions.reuseLagYears).toBe(20);
    expect(e.manufacturePossible!.ranges[0].end).toBe('2011-12-26');
    expect(e.caveats.join(' ')).toMatch(/adjustable assumption/);
  });

  it('a lower bound seen on the globe is hard for manufacture too', () => {
    const e = est([shows('bangladesh-independent')]);
    expect(e.manufactureLikely!.ranges[0].start).toBe('1971-03-26');
    expect(e.manufacturePossible!.ranges[0].start).toBe('1971-03-26');
    expect(e.caveats.join(' ')).not.toMatch(/adds \d+ years/); // no upper bound, so no lag was needed
  });

  it('a printed date bounds content from above and manufacture from below, separately', () => {
    const e = est([shows('ceylon-name'), createPrintedDateClue({ year: 1960 })]);
    expect(e.information!.ranges[0].end).toBe('1960-12-31'); // content cannot postdate the printed year
    expect(e.manufactureLikely!.ranges).toEqual([{ start: '1960-01-01', end: '1960-12-31' }]);
    expect(e.manufacturePossible!.ranges).toEqual([{ start: '1960-01-01', end: '1970-12-31' }]);
    // The globe is not claimed to be older than its printed date.
    expect(containsDate(e.manufacturePossible!.ranges, '1955-06-01')).toBe(false);
  });

  it('a printed date later than the content: made from older plates', () => {
    const e = est([shows('ussr-exists'), createPrintedDateClue({ year: 1995 })]);
    expect(e.information!.ranges[0].end).toBe('1991-12-26');
    expect(e.manufactureLikely).toBeNull();
    expect(e.manufacturePossible!.ranges[0]).toEqual({ start: '1995-01-01', end: '2001-12-26' });
    expect(e.caveats.join(' ')).toMatch(/older plates/);
  });

  it('a printed date far beyond the reuse allowance is flagged, not silently accepted', () => {
    const e = est([shows('ceylon-name'), createPrintedDateClue({ year: 2005 })]);
    expect(e.status).toBe('ok');
    expect(e.manufacturePossible).toBeNull();
    expect(e.confidence.manufacture.level).toBe('none');
    expect(e.caveats.join(' ')).toMatch(/longer than the reuse allowance/);
    // A larger allowance accepts it.
    expect(est([shows('ceylon-name'), createPrintedDateClue({ year: 2005 })], { reuseLagYears: 40 }).manufacturePossible).not.toBeNull();
  });

  it('never presents a single year: even a tight result is a dated range with its caveats', () => {
    const e = est([shows('bangladesh-independent'), shows('ceylon-name')]);
    const r = e.information!.ranges[0];
    expect(r.start).not.toBe(r.end);
    expect(e.headline).toMatch(/dates from/);
    expect(e.headline).toMatch(/Confidence/);
  });
});

describe('confidence', () => {
  it('width score falls as the range widens', () => {
    const s = [0.5, 2, 4, 8, 20, 40, 80, 300].map(widthScore);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1]);
    expect(widthScore(null)).toBe(0);
  });

  it('two corroborating clues give a narrow range a high content confidence but only medium for manufacture', () => {
    const e = est([shows('bangladesh-independent'), shows('ceylon-name')]);
    expect(e.confidence.information.level).toBe('high');
    expect(e.confidence.manufacture.level).toBe('medium');
  });

  it('a single, wide clue is low', () => {
    const e = est([shows('ussr-exists')]);
    expect(e.confidence.information.level).toBe('low');
    expect(e.confidence.manufacture.level).toBe('low');
  });

  it('a single deciding clue is never high even if narrow', () => {
    const e = est([shows('nur-sultan-name')]);
    expect(e.confidence.information.level).not.toBe('high');
  });

  it('an uncertain reading lowers the evidence score', () => {
    const sure = est([createClue('bangladesh-independent', 'shows'), shows('ceylon-name')]);
    const unsure = est([createClue('bangladesh-independent', 'shows', { certainty: 'uncertain' }), shows('ceylon-name')]);
    expect(unsure.confidence.information.score).toBeLessThan(sure.confidence.information.score);
  });

  it('explains every factor', () => {
    const c = est([shows('ussr-exists')]).confidence.information;
    expect(c.factors.map((f) => f.id)).toEqual(['range-width', 'evidence-quality', 'corroboration', 'absence-evidence', 'conflict']);
    for (const f of c.factors) {
      expect(f.detail.length).toBeGreaterThan(10);
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(1);
    }
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(1);
  });

  it('computeConfidence with no deciding clues scores zero evidence', () => {
    const c = computeConfidence({ width: 1, binding: [], relyOnReuseLag: false, manufacture: false });
    expect(c.factors.find((f) => f.id === 'evidence-quality')!.score).toBe(0);
    expect(c.level).not.toBe('high');
  });
});

describe('edge cases', () => {
  it('no clues', () => {
    const e = est([]);
    expect(e.status).toBe('no-clues');
    expect(e.information).toBeNull();
    expect(e.headline).toMatch(/Add clues/);
  });

  it('invalid clues are excluded and reported, never silently used', () => {
    const bad: Clue = { ...shows('ussr-exists'), id: 'bad', contentRanges: [{ start: '1991-12-26', end: '1922-12-30' }] };
    const e = est([bad, shows('ceylon-name')]);
    expect(e.invalidClues).toHaveLength(1);
    expect(e.invalidClues[0].clueId).toBe('bad');
    expect(e.information!.ranges[0].end).toBe('1972-05-21');
    expect(est([bad]).status).toBe('no-clues');
  });

  it('unknown event ids throw rather than yielding a made-up clue', () => {
    expect(() => createClue('no-such-event', 'shows')).toThrow(/Unknown historical event/);
  });

  it('is deterministic for a fixed today', () => {
    const clues = createClues([
      { eventId: 'ussr-exists', observation: 'shows' },
      { eventId: 'bangladesh-independent', observation: 'shows', certainty: 'probable' },
    ]);
    expect(est(clues)).toEqual(est(clues));
  });

  it('formats headline year spans', () => {
    expect(yearSpanText([{ start: '1949-10-07', end: '1990-10-02' }])).toBe('1949–1990');
    expect(yearSpanText([{ start: '1971-03-26', end: null }])).toBe('1971 or later');
    expect(yearSpanText([{ start: null, end: '1972-05-21' }])).toBe('1972 or earlier');
    expect(yearSpanText([])).toBe('no date');
  });
});
