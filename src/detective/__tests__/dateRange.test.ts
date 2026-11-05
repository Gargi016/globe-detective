import { describe, expect, it } from 'vitest';
import {
  addYears,
  complement,
  containsDate,
  extendEnds,
  fromDay,
  gapDaysBetween,
  intersect,
  intersectAll,
  isEmpty,
  isValidIsoDate,
  normalize,
  toDay,
  widthYears,
} from '../dateRange';

const r = (start: string | null, end: string | null) => ({ start, end });

describe('calendar helpers', () => {
  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('1972-05-22')).toBe(true);
    expect(isValidIsoDate('1972-02-30')).toBe(false);
    expect(isValidIsoDate('1900-02-29')).toBe(false); // 1900 is not a leap year
    expect(isValidIsoDate('2000-02-29')).toBe(true);
    expect(isValidIsoDate('1972-5-22')).toBe(false);
    expect(isValidIsoDate(19720522)).toBe(false);
  });

  it('converts to and from day numbers without drift', () => {
    for (const d of ['1886-01-01', '1945-05-08', '1991-12-26', '2000-02-29', '2019-12-31', '0999-01-01']) {
      expect(fromDay(toDay(d))).toBe(d);
    }
    expect(toDay('1970-01-02') - toDay('1970-01-01')).toBe(1);
  });

  it('adds years, stepping a leap day back to 28 February', () => {
    expect(addYears('1990-10-03', 10)).toBe('2000-10-03');
    expect(addYears('2000-02-29', 1)).toBe('2001-02-28');
    expect(addYears('2000-02-29', 4)).toBe('2004-02-29');
  });
});

describe('range sets', () => {
  it('merges overlapping and touching ranges and drops empties', () => {
    expect(normalize([r('1950-01-01', '1950-12-31'), r('1951-01-01', '1960-01-01'), r('1990-01-01', '1980-01-01')])).toEqual([
      r('1950-01-01', '1960-01-01'),
    ]);
  });

  it('intersects bounded and open ranges', () => {
    expect(intersect([r('1949-10-07', '1990-10-02')], [r('1971-03-26', null)])).toEqual([r('1971-03-26', '1990-10-02')]);
    expect(intersect([r(null, '1972-05-21')], [r(null, '1991-12-26')])).toEqual([r(null, '1972-05-21')]);
    expect(isEmpty(intersect([r(null, '1972-05-21')], [r('1972-05-22', null)]))).toBe(true);
  });

  it('intersects unions of ranges', () => {
    const siam = [r(null, '1939-06-23'), r('1945-09-11', '1949-05-10')];
    const pakistan = [r('1947-08-14', null)];
    expect(intersect(siam, pakistan)).toEqual([r('1947-08-14', '1949-05-10')]);
  });

  it('complements a range set', () => {
    expect(complement([r('1922-12-30', '1991-12-26')])).toEqual([r(null, '1922-12-29'), r('1991-12-27', null)]);
    expect(complement([r(null, '1972-05-21')])).toEqual([r('1972-05-22', null)]);
    expect(complement([])).toEqual([r(null, null)]);
    expect(complement([r(null, null)])).toEqual([]);
  });

  it('complement is an involution on normalised sets', () => {
    const s = [r('1918-11-18', '1940-08-05'), r('1991-09-06', null)];
    expect(complement(complement(s))).toEqual(normalize(s));
  });

  it('intersectAll of nothing is all time', () => {
    expect(intersectAll([])).toEqual([r(null, null)]);
  });

  it('tests membership, gaps, width and extension', () => {
    expect(containsDate([r('1949-10-07', '1990-10-02')], '1990-10-02')).toBe(true);
    expect(containsDate([r('1949-10-07', '1990-10-02')], '1990-10-03')).toBe(false);
    expect(gapDaysBetween([r(null, '1972-05-21')], [r('1972-05-24', null)])).toBe(2);
    expect(gapDaysBetween([r(null, '1972-05-21')], [r('1972-05-22', null)])).toBe(0);
    expect(widthYears([r('1971-01-01', '1971-12-31')], '1492-01-01', '2026-11-01')).toBeCloseTo(1, 1);
    expect(widthYears([r('1971-01-01', null)], '1492-01-01', '2021-01-01')).toBeCloseTo(50, 0);
    expect(extendEnds([r('1950-01-01', '1960-06-01'), r('1990-01-01', null)], 10)).toEqual([
      r('1950-01-01', '1970-06-01'),
      r('1990-01-01', null),
    ]);
  });
});
