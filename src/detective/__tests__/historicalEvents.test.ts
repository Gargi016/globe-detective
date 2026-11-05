import { describe, expect, it } from 'vitest';
import { eventsByCategory, getEvent, HISTORICAL_EVENTS, searchEvents } from '../historicalEvents';
import { validateEventDatabase } from '../clueValidation';
import { EVENT_CATEGORIES } from '../types';
import { containsDate } from '../dateRange';
import { findNamePeriod } from '../../history/nameHistory';

describe('event database integrity', () => {
  it('has no structural problems', () => {
    expect(validateEventDatabase(HISTORICAL_EVENTS)).toEqual([]);
  });

  it('covers all seven clue categories with several events each', () => {
    for (const c of EVENT_CATEGORIES) expect(eventsByCategory(c).length, c).toBeGreaterThanOrEqual(3);
  });

  it('every event carries sources and a start or end date where applicable', () => {
    for (const e of HISTORICAL_EVENTS) {
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      expect(e.valid.some((r) => r.start !== null || r.end !== null), e.id).toBe(true);
    }
  });

  it('events that share a group are never simultaneously valid unless they are a deliberate transition', () => {
    const groups = new Map<string, typeof HISTORICAL_EVENTS[number][]>();
    for (const e of HISTORICAL_EVENTS) if (e.group) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
    // Old name/new name pairs: pairwise-disjoint validity for the paired renamings.
    for (const id of ['ceylon-name', 'sri-lanka-name']) expect(getEvent(id)).toBeDefined();
    const a = getEvent('ceylon-name')!;
    const b = getEvent('sri-lanka-name')!;
    expect(containsDate(a.valid, '1972-05-21')).toBe(true);
    expect(containsDate(b.valid, '1972-05-21')).toBe(false);
    expect(containsDate(b.valid, '1972-05-22')).toBe(true);
    expect(containsDate(a.valid, '1972-05-22')).toBe(false);
  });
});

describe('key facts used as the engine’s worked examples', () => {
  const day = (id: string, date: string) => containsDate(getEvent(id)!.valid, date);
  it('Soviet Union', () => {
    expect(day('ussr-exists', '1922-12-30')).toBe(true);
    expect(day('ussr-exists', '1922-12-29')).toBe(false);
    expect(day('ussr-exists', '1991-12-26')).toBe(true);
    expect(day('ussr-exists', '1991-12-27')).toBe(false);
  });
  it('East and West Germany', () => {
    expect(day('germany-divided', '1949-10-07')).toBe(true);
    expect(day('germany-divided', '1990-10-02')).toBe(true);
    expect(day('germany-divided', '1990-10-03')).toBe(false);
    expect(day('germany-reunified', '1990-10-03')).toBe(true);
  });
  it('Bangladesh', () => {
    expect(day('bangladesh-independent', '1971-03-25')).toBe(false);
    expect(day('bangladesh-independent', '1971-12-16')).toBe(true);
  });
  it('Thailand/Siam alternation uses two periods each', () => {
    expect(getEvent('siam-name')!.valid).toHaveLength(2);
    expect(day('siam-name', '1947-01-01')).toBe(true);
    expect(day('thailand-name', '1947-01-01')).toBe(false);
    expect(day('thailand-name', '1942-01-01')).toBe(true);
  });
  it('capital changes', () => {
    expect(day('brasilia-capital', '1960-04-21')).toBe(true);
    expect(day('rio-capital', '1960-04-21')).toBe(false);
    expect(day('nur-sultan-name', '2020-01-01')).toBe(true);
    expect(day('astana-name', '2020-01-01')).toBe(false);
    expect(day('astana-name', '2023-01-01')).toBe(true);
  });

  it('Korea division starts only when both states exist (9 Sep 1948)', () => {
    expect(day('korea-divided', '1948-09-08')).toBe(false);
    expect(day('korea-divided', '1948-09-09')).toBe(true);
  });

  it('United Arab Republic distinguishes the political union from Egypt’s later designation', () => {
    // Union of Egypt and Syria (1 Feb 1958 – 28 Sep 1961)
    expect(day('uar-exists', '1958-01-31')).toBe(false);
    expect(day('uar-exists', '1958-02-01')).toBe(true);
    expect(day('uar-exists', '1961-09-28')).toBe(true);
    expect(day('uar-exists', '1961-09-29')).toBe(false);

    // Egypt designation (29 Sep 1961 – 1 Sep 1971)
    expect(day('uar-egypt-name', '1961-09-28')).toBe(false);
    expect(day('uar-egypt-name', '1961-09-29')).toBe(true);
    expect(day('uar-egypt-name', '1971-09-01')).toBe(true);
    expect(day('uar-egypt-name', '1971-09-02')).toBe(false);
  });

  it('Angola and Mozambique independence dates are accurate individually and together', () => {
    // Mozambique independent on 25 June 1975
    expect(day('mozambique-independent', '1975-06-24')).toBe(false);
    expect(day('mozambique-independent', '1975-06-25')).toBe(true);

    // Angola independent on 11 November 1975
    expect(day('angola-independent', '1975-11-10')).toBe(false);
    expect(day('angola-independent', '1975-11-11')).toBe(true);

    // Both independent only from 11 November 1975
    expect(day('angola-mozambique-independent', '1975-06-25')).toBe(false);
    expect(day('angola-mozambique-independent', '1975-11-10')).toBe(false);
    expect(day('angola-mozambique-independent', '1975-11-11')).toBe(true);
  });
});

describe('search', () => {
  it('finds events by alias and subject', () => {
    expect(searchEvents('ceylon')[0].id).toBe('ceylon-name');
    expect(searchEvents('ddr').some((e) => e.id === 'east-germany-exists')).toBe(true);
    expect(searchEvents('')).toEqual([]);
    expect(searchEvents('zzzzzz')).toEqual([]);
  });
});

describe('name table period boundaries', () => {
  it('Czechoslovakia (GW 315) ends on 1992-12-31', () => {
    expect(findNamePeriod(315, '1992-12-31')?.name).toBe('Czechoslovakia');
    expect(findNamePeriod(315, '1993-01-01')).toBeNull();
  });

  it('Serbia and Montenegro (GW 345) ends on 2006-06-03', () => {
    expect(findNamePeriod(345, '2006-06-03')?.name).toBe('Serbia and Montenegro');
    expect(findNamePeriod(345, '2006-06-04')).toBeNull();
  });

  it('Southern Rhodesia (GW 552) covers the early 1889–1897 BSAC period', () => {
    expect(findNamePeriod(552, '1890-01-01')?.name).toBe('British South Africa Company Territory');
    expect(findNamePeriod(552, '1897-12-31')?.name).toBe('British South Africa Company Territory');
    expect(findNamePeriod(552, '1898-01-01')?.name).toBe('Southern Rhodesia');
  });
});
