import { describe, expect, it } from 'vitest';
import { describeResult, distanceFromInterval, parseGuess, pointsForDistance, scoreGuess, SCORE_TIERS } from '../scoring';

describe('score table from the brief', () => {
  it.each([
    [0, 100], [1, 95], [2, 80], [5, 80], [6, 60], [10, 60], [11, 30], [20, 30], [21, 10], [80, 10], [400, 10],
  ])('a distance of %i years scores %i', (d, pts) => {
    expect(pointsForDistance(d)).toBe(pts);
  });

  it('is monotonic: further never scores more', () => {
    let prev = 101;
    for (let d = 0; d <= 60; d++) {
      const p = pointsForDistance(d);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it('exposes six tiers with the specified points', () => {
    expect(SCORE_TIERS.map((t) => t.points)).toEqual([100, 95, 80, 60, 30, 10]);
  });
});

describe('distance from an interval, not an invented year', () => {
  const span = { startYear: 1964, endYear: 1966 };
  it('is zero anywhere inside', () => {
    for (const y of [1964, 1965, 1966]) expect(distanceFromInterval(y, span)).toBe(0);
  });
  it('is the distance to the nearest edge outside', () => {
    expect(distanceFromInterval(1963, span)).toBe(1);
    expect(distanceFromInterval(1958, span)).toBe(6);
    expect(distanceFromInterval(1967, span)).toBe(1);
    expect(distanceFromInterval(1990, span)).toBe(24);
  });
  it('a single-year interval needs the exact year', () => {
    expect(distanceFromInterval(1991, { startYear: 1991, endYear: 1991 })).toBe(0);
    expect(distanceFromInterval(1992, { startYear: 1991, endYear: 1991 })).toBe(1);
  });
  it('scores end to end', () => {
    expect(scoreGuess(1965, span).points).toBe(100);
    expect(scoreGuess(1965, span).inside).toBe(true);
    expect(scoreGuess(1960, span)).toMatchObject({ distance: 4, base: 80, points: 80, inside: false });
    expect(scoreGuess(1900, span).points).toBe(10);
  });
  it('hints are recorded and cost nothing unless a penalty is configured', () => {
    expect(scoreGuess(1965, span, 3)).toMatchObject({ base: 100, penalty: 0, points: 100 });
  });
});

describe('guess parsing and wording', () => {
  it('accepts four-digit years in range only', () => {
    expect(parseGuess(' 1962 ')).toEqual({ ok: true, year: 1962 });
    for (const bad of ['', '62', '19620', 'abcd', '1962.5', '1799', '2101', '-1962']) expect(parseGuess(bad).ok, bad).toBe(false);
  });
  it('describes inside and outside results', () => {
    expect(describeResult(scoreGuess(1991, { startYear: 1991, endYear: 1991 }), { startYear: 1991, endYear: 1991 })).toMatch(/Exactly right/);
    expect(describeResult(scoreGuess(1965, { startYear: 1964, endYear: 1966 }), { startYear: 1964, endYear: 1966 })).toMatch(/any guess in it is exact/);
    expect(describeResult(scoreGuess(1960, { startYear: 1964, endYear: 1966 }), { startYear: 1964, endYear: 1966 })).toMatch(/4 years earlier/);
  });
});
