import type { DateRange, IsoDate } from './types';

/**
 * Calendar arithmetic and interval-set algebra on inclusive day ranges.
 * Internally a range is [lo, hi] in whole days since 1970-01-01 (UTC) with ±Infinity for open ends.
 */

export const DAY_MS = 86_400_000;

export function isValidIsoDate(s: unknown): s is IsoDate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // setUTCFullYear guards the 0–99 → 1900s coercion of Date.UTC
  t.setUTCFullYear(y);
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function toDay(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(y);
  return Math.round(t.getTime() / DAY_MS);
}

export function fromDay(day: number): IsoDate {
  const t = new Date(day * DAY_MS);
  const y = String(t.getUTCFullYear()).padStart(4, '0');
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return fromDay(toDay(iso) + n);
}

export function addYears(iso: IsoDate, years: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(y + years);
  // 29 Feb + n years that is not a leap year rolls into March: step back to the last day of February.
  if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
  return fromDay(Math.round(t.getTime() / DAY_MS));
}

export function todayIso(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatIso(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// ---------- interval sets -------------------------------------------------------------------------

export interface Span {
  lo: number;
  hi: number;
}

const toSpan = (r: DateRange): Span => ({
  lo: r.start === null ? -Infinity : toDay(r.start),
  hi: r.end === null ? Infinity : toDay(r.end),
});

const fromSpan = (s: Span): DateRange => ({
  start: Number.isFinite(s.lo) ? fromDay(s.lo) : null,
  end: Number.isFinite(s.hi) ? fromDay(s.hi) : null,
});

/** Sorted, merged (overlapping or touching) spans; empty spans dropped. */
function normalizeSpans(spans: Span[]): Span[] {
  const sorted = spans.filter((s) => s.lo <= s.hi).sort((a, b) => a.lo - b.lo);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.lo <= last.hi + 1) last.hi = Math.max(last.hi, s.hi);
    else out.push({ ...s });
  }
  return out;
}

export function normalize(ranges: DateRange[]): DateRange[] {
  return normalizeSpans(ranges.map(toSpan)).map(fromSpan);
}

export const ALL_TIME: DateRange[] = [{ start: null, end: null }];

export function intersect(a: DateRange[], b: DateRange[]): DateRange[] {
  const A = normalizeSpans(a.map(toSpan));
  const B = normalizeSpans(b.map(toSpan));
  const out: Span[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i].lo, B[j].lo);
    const hi = Math.min(A[i].hi, B[j].hi);
    if (lo <= hi) out.push({ lo, hi });
    if (A[i].hi < B[j].hi) i += 1;
    else j += 1;
  }
  return out.map(fromSpan);
}

export function intersectAll(sets: DateRange[][]): DateRange[] {
  return sets.reduce((acc, s) => intersect(acc, s), ALL_TIME);
}

/** Everything not covered by `ranges`. */
export function complement(ranges: DateRange[]): DateRange[] {
  const N = normalizeSpans(ranges.map(toSpan));
  const out: Span[] = [];
  let cursor = -Infinity;
  for (const s of N) {
    if (s.lo > cursor) out.push({ lo: cursor, hi: s.lo - 1 });
    cursor = s.hi + 1;
  }
  if (cursor <= Infinity && !(N.length > 0 && N[N.length - 1].hi === Infinity)) out.push({ lo: cursor, hi: Infinity });
  return out.map(fromSpan);
}

export function isEmpty(ranges: DateRange[]): boolean {
  return normalize(ranges).length === 0;
}

export function containsDate(ranges: DateRange[], iso: IsoDate): boolean {
  const d = toDay(iso);
  return normalizeSpans(ranges.map(toSpan)).some((s) => s.lo <= d && d <= s.hi);
}

export function sameRanges(a: DateRange[], b: DateRange[]): boolean {
  const A = normalize(a);
  const B = normalize(b);
  return A.length === B.length && A.every((r, i) => r.start === B[i].start && r.end === B[i].end);
}

/** Clamp open ends to [floor, ceil] and drop what falls outside. */
export function clamp(ranges: DateRange[], floor: IsoDate, ceil: IsoDate): DateRange[] {
  return intersect(ranges, [{ start: floor, end: ceil }]);
}

/** Whole days between the end of `a` and the start of `b` (b after a), exclusive; 0 if adjacent. */
export function gapDaysBetween(a: DateRange[], b: DateRange[]): number | null {
  const A = normalizeSpans(a.map(toSpan));
  const B = normalizeSpans(b.map(toSpan));
  if (A.length === 0 || B.length === 0) return null;
  let best = Infinity;
  for (const x of A) {
    for (const y of B) {
      const gap = y.lo > x.hi ? y.lo - x.hi - 1 : x.lo > y.hi ? x.lo - y.hi - 1 : 0;
      best = Math.min(best, gap);
    }
  }
  return Number.isFinite(best) ? best : null;
}

/** Extend the end of every range by `years`; open ends stay open. */
export function extendEnds(ranges: DateRange[], years: number): DateRange[] {
  return normalize(ranges.map((r) => ({ start: r.start, end: r.end === null ? null : addYears(r.end, years) })));
}

export function widthYears(ranges: DateRange[], floor: IsoDate, ceil: IsoDate): number | null {
  const N = normalizeSpans(clamp(ranges, floor, ceil).map(toSpan));
  if (N.length === 0) return null;
  const days = N.reduce((sum, s) => sum + (s.hi - s.lo + 1), 0);
  return days / 365.2425;
}

export function describeRanges(ranges: DateRange[], noEarlierBound = 'no earlier bound'): string {
  const N = normalize(ranges);
  if (N.length === 0) return 'no date';
  return N.map((r) => {
    if (r.start && r.end) return `${formatIso(r.start)} – ${formatIso(r.end)}`;
    if (r.start) return `from ${formatIso(r.start)} (no later bound)`;
    if (r.end) return `up to ${formatIso(r.end)} (${noEarlierBound})`;
    return 'any date';
  }).join('; or ');
}
