import { containsDate } from '../detective/dateRange';
import { HISTORICAL_EVENTS } from '../detective/historicalEvents';
import type { HistoricalEvent } from '../detective/types';
import { DATASET_META, formatDate } from '../history/historyService';
import type { HistoryService } from '../history/historyService';
import type { Challenge } from './generator';

export interface Boundary {
  date: string;
  label: string;
  items: string[];
}

export interface Reveal {
  refDate: string;
  refDateText: string;
  intervalText: string;
  /** What visibly changed to start this map, and what changes it next. */
  begins: Boundary;
  ends: Boundary;
  /** Names on this map that were sourced for the period. */
  names: { gw: number; name: string; official: string | null }[];
  events: HistoricalEvent[];
}

const dayAfter = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function changesOn(service: HistoryService, date: string): string[] {
  const year = Number(date.slice(0, 4));
  const items = service
    .changesInYear(year)
    .filter((c) => c.date === date && c.magnitude === 'major')
    .map((c) => c.title);
  for (const n of service.nameChangesInYear(year)) if (n.date === date) items.push(`${n.from} → ${n.to}`);
  return [...new Set(items)].slice(0, 6);
}

/** The reference date, the span it belongs to, why the span starts and ends, and the dated clues. All from real data. */
export function buildReveal(service: HistoryService, challenge: Challenge): Reveal {
  const { interval, refDate } = challenge;
  const snap = service.snapshot(challenge.year, challenge.anchor);
  const features = snap.covered ? snap.features : [];

  const beginsAtCoverage = interval.start <= DATASET_META.coverageStart;
  const endsAtCoverage = interval.end >= DATASET_META.coverageEnd;
  const nextDate = dayAfter(interval.end);

  const begins: Boundary = {
    date: interval.start,
    label: beginsAtCoverage ? `The dataset begins on ${formatDate(interval.start)}` : `From ${formatDate(interval.start)}`,
    items: beginsAtCoverage ? [] : changesOn(service, interval.start),
  };
  const ends: Boundary = {
    date: interval.end,
    label: endsAtCoverage ? `The dataset ends on ${formatDate(interval.end)}` : `Until ${formatDate(interval.end)}, changed on ${formatDate(nextDate)}`,
    items: endsAtCoverage ? [] : changesOn(service, nextDate),
  };

  const names = features
    .filter((f) => f.properties.nameInfo.provenance === 'verified' && f.properties.name !== f.properties.datasetLabel)
    .map((f) => ({ gw: f.properties.gw, name: f.properties.name, official: f.properties.nameInfo.official }))
    .slice(0, 8);

  const refYear = Number(refDate.slice(0, 4));
  const events = HISTORICAL_EVENTS.filter((e) => containsDate(e.valid, refDate))
    .map((e) => ({ e, d: Math.abs(Number(e.eventDate.slice(0, 4)) - refYear) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map((x) => x.e);

  const single = interval.startYear === interval.endYear;
  return {
    refDate,
    refDateText: formatDate(refDate),
    intervalText: `${formatDate(interval.start)} – ${formatDate(interval.end)}${single ? '' : ` (${interval.startYear}–${interval.endYear})`}`,
    begins,
    ends,
    names,
    events,
  };
}
