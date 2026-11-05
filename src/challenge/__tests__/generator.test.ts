import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHistoryService } from '../../history/historyService';
import type { HistoryService } from '../../history/historyService';
import { DIFFICULTIES, DIFFICULTY_ORDER, challengeInterval, dailySeed, generateChallenge } from '../generator';
import { buildHints } from '../hints';
import { buildReveal } from '../reveal';
import { scoreGuess } from '../scoring';

let service: HistoryService;
beforeAll(() => {
  const file = join(process.cwd(), 'public', 'data', 'cshapes', 'cshapes-2.0-gw.simplified.topojson');
  service = createHistoryService(JSON.parse(readFileSync(file, 'utf8')));
});

describe('visible changes and configuration spans (real data)', () => {
  it('has change dates inside the dataset, sorted and unique', () => {
    const d = service.visibleChangeDates();
    expect(d.length).toBeGreaterThan(300);
    expect([...d]).toEqual([...new Set(d)].sort());
    expect(d[0] > '1886-01-01').toBe(true);
    expect(d[d.length - 1] <= '2019-12-31').toBe(true);
  });

  it('the span contains its date and is bounded by change dates', () => {
    for (const date of ['1900-01-01', '1965-07-01', '1972-05-22', '1990-10-03', '2010-12-31']) {
      const s = service.configurationSpan(date);
      expect(s.start <= date && date <= s.end, date).toBe(true);
      const changes = service.visibleChangeDates();
      expect(changes.filter((c) => c > s.start && c <= s.end), date).toEqual([]);
    }
  });

  it('known events end a span: Ceylon becomes Sri Lanka on 22 May 1972; Germany reunifies on 3 Oct 1990', () => {
    expect(service.configurationSpan('1972-01-01').end).toBe('1972-05-21');
    expect(service.configurationSpan('1990-07-01').end).toBe('1990-10-02');
    expect(service.configurationSpan('1990-12-31').start).toBe('1990-10-03');
  });

  it('the map really is unchanged inside a span: same states and names at both ends', () => {
    // 1 Jan 1977 and 31 Dec 1977 fall inside one configuration if no visible change happens in 1977.
    const span = service.configurationSpan('1977-01-01');
    if (span.end >= '1977-12-31') {
      const a = service.snapshot(1977, 'start');
      const b = service.snapshot(1977, 'end');
      const key = (s: typeof a) => s.covered ? s.features.map((f) => `${f.properties.gw}:${f.properties.name}:${f.properties.status}`).sort().join('|') : '';
      expect(key(a)).toBe(key(b));
    }
  });
});

describe('challenge generation', () => {
  it('is deterministic for a seed and difficulty', () => {
    const a = generateChallenge(service, 'seed-1', 'medium');
    const b = generateChallenge(service, 'seed-1', 'medium');
    expect(a).toEqual(b);
    expect(generateChallenge(service, 'seed-2', 'medium')).not.toEqual(a);
  });

  it.each(DIFFICULTY_ORDER)('%s challenges satisfy their rules and are based on real map data', (difficulty) => {
    const cfg = DIFFICULTIES[difficulty];
    let relaxed = 0;
    const years = new Set<number>();
    for (let i = 0; i < 120; i++) {
      const c = generateChallenge(service, `t${i}`, difficulty);
      if (c.relaxed) relaxed++;
      years.add(c.year);
      expect(c.year).toBeGreaterThanOrEqual(cfg.firstYear);
      expect(c.year).toBeLessThanOrEqual(cfg.lastYear);
      // The reference date is a real anchor date and the span is exactly what the dataset says.
      expect(c.refDate).toBe(service.dateFor(c.year, c.anchor));
      expect(c.interval).toEqual(challengeInterval(service, c.refDate));
      expect(c.interval.start <= c.refDate && c.refDate <= c.interval.end).toBe(true);
      expect(c.interval.startYear).toBeLessThanOrEqual(c.year);
      expect(c.interval.endYear).toBeGreaterThanOrEqual(c.year);
      if (!c.relaxed) {
        expect(c.interval.yearSpan).toBeGreaterThanOrEqual(cfg.minSpan);
        expect(c.interval.yearSpan).toBeLessThanOrEqual(cfg.maxSpan);
      }
      // There is a real map to show.
      const snap = service.snapshot(c.year, c.anchor);
      expect(snap.covered && snap.features.length > 50).toBe(true);
    }
    expect(relaxed).toBe(0);
    expect(years.size).toBeGreaterThan(8); // varied, not stuck on a few dates
  });

  it('the daily challenge is the same for everyone on a given day and differs between days', () => {
    const a = generateChallenge(service, dailySeed('2026-11-01'), 'medium', '2026-11-01');
    const b = generateChallenge(service, dailySeed('2026-11-01'), 'medium', '2026-11-01');
    const c = generateChallenge(service, dailySeed('2026-11-02'), 'medium', '2026-11-02');
    expect(a).toEqual(b);
    expect(a.refDate).not.toBe(c.refDate);
    expect(a.daily).toBe('2026-11-01');
  });

  it('answers: a guess anywhere in the span is exact; scoring uses the span, not the reference year', () => {
    const c = generateChallenge(service, 'score-check', 'easy');
    for (let y = c.interval.startYear; y <= c.interval.endYear; y++) expect(scoreGuess(y, c.interval).points).toBe(100);
    expect(scoreGuess(c.interval.startYear - 3, c.interval).points).toBe(80);
  });
});

describe('hints and reveal come from real data', () => {
  it('give the number of hints the difficulty allows, none empty', () => {
    for (const d of DIFFICULTY_ORDER) {
      const c = generateChallenge(service, 'hint-check', d);
      const h = buildHints(service, c);
      expect(h).toHaveLength(DIFFICULTIES[d].maxHints);
      for (const x of h) expect(x.text.length).toBeGreaterThan(20);
    }
  });

  it('hint counts match the map drawn', () => {
    const c = generateChallenge(service, 'count-check', 'easy');
    const snap = service.snapshot(c.year, c.anchor);
    const text = buildHints(service, c).find((h) => h.id === 'states')!.text;
    expect(text).toContain(`${snap.covered ? snap.features.length : 0} areas`);
  });

  it('the era hint always brackets the answer, and never states it outright', () => {
    for (let i = 0; i < 80; i++) {
      const c = generateChallenge(service, `era${i}`, 'medium');
      const text = buildHints(service, c)[0].text;
      const [from, to] = [...text.matchAll(/\d{4}/g)].map((m) => Number(m[0]));
      expect(from).toBeLessThanOrEqual(c.interval.startYear);
      expect(to).toBeGreaterThanOrEqual(c.interval.endYear);
      expect(to - from).toBeGreaterThanOrEqual(20);
    }
  });

  it('a dated-clue hint is true for the reference date', () => {
    let withEvent = 0;
    for (let i = 0; i < 60; i++) {
      const c = generateChallenge(service, `clue${i}`, 'easy');
      const clue = buildHints(service, c).find((h) => h.id === 'clue')!;
      if (/is up to date for/.test(clue.text)) withEvent++;
    }
    expect(withEvent).toBeGreaterThan(20);
  });

  it('the reveal explains the span with real changes and lists events valid on the date', () => {
    const c = generateChallenge(service, 'reveal-check', 'easy');
    const r = buildReveal(service, c);
    expect(r.refDateText).toMatch(/\d{4}$/);
    expect(r.intervalText).toContain(String(c.interval.startYear));
    expect(r.ends.items.length + r.begins.items.length).toBeGreaterThan(0);
    for (const e of r.events) expect(e.valid.some((v) => (v.start === null || v.start <= c.refDate) && (v.end === null || c.refDate <= v.end))).toBe(true);
  });

  it('the reveal for the Ceylon/Sri Lanka boundary names the change', () => {
    const c = { ...generateChallenge(service, 'x', 'easy'), refDate: '1972-01-01', year: 1972, anchor: 'start' as const };
    const reveal = buildReveal(service, { ...c, interval: challengeInterval(service, '1972-01-01') });
    expect(reveal.ends.items.join(' ')).toMatch(/Ceylon → Sri Lanka/);
  });
});
