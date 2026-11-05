import { containsDate, describeRanges } from '../detective/dateRange';
import { HISTORICAL_EVENTS } from '../detective/historicalEvents';
import type { HistoryService } from '../history/historyService';
import { STATUS_LABEL, STATUS_ORDER } from '../history/types';
import type { Challenge } from './generator';
import { DIFFICULTIES } from './generator';
import { pick, rngFor } from './random';

export interface Hint {
  id: 'era' | 'states' | 'name' | 'clue';
  title: string;
  text: string;
}

/** A window of years containing the answer span, wide enough that it is only a rough bracket. */
export function eraWindow(startYear: number, endYear: number, width: number): { from: number; to: number } {
  const mid = Math.round((startYear + endYear) / 2);
  let from = Math.floor((mid - width / 2) / 5) * 5;
  let to = from + width;
  if (startYear < from) from = Math.floor(startYear / 5) * 5;
  if (endYear > to) to = Math.ceil(endYear / 5) * 5;
  return { from, to };
}

const plural = (label: string, n: number) => (n === 1 ? label.toLowerCase() : `${label.toLowerCase()}s`);

/**
 * Four hints, from vaguest to most revealing. Each is computed from the same real data as the map, so none
 * is invented: a bracket of years, counts of what is drawn, a name printed on the map, and finally a dated event
 * that pins the period down.
 */
export function buildHints(service: HistoryService, challenge: Challenge): Hint[] {
  const snap = service.snapshot(challenge.year, challenge.anchor);
  const features = snap.covered ? snap.features : [];
  const { startYear, endYear } = challenge.interval;
  const rng = rngFor(`${challenge.id}|hints`);

  // 1. era
  const win = eraWindow(startYear, endYear, 40);
  const era: Hint = {
    id: 'era',
    title: 'The era',
    text: `The map was drawn for a date between ${win.from} and ${win.to}.`,
  };

  // 2. what is drawn
  const counts = snap.covered ? snap.counts : null;
  const parts = counts
    ? STATUS_ORDER.filter((s) => counts[s] > 0 && s !== 'independent').map((s) => `${counts[s]} ${plural(STATUS_LABEL[s], counts[s])}`)
    : [];
  const states: Hint = {
    id: 'states',
    title: 'What is drawn',
    text: counts
      ? `${features.length} areas are drawn: ${counts.independent} independent state${counts.independent === 1 ? '' : 's'}${parts.length ? `, ${parts.join(', ')}` : ''}.`
      : 'No areas are drawn.',
  };

  // 3. a name on the map: prefer a sourced name that is no longer the label the dataset uses
  const verified = features.filter((f) => f.properties.nameInfo.provenance === 'verified');
  const old = verified.filter((f) => f.properties.name.toLowerCase() !== f.properties.datasetLabel.toLowerCase());
  const pool = old.length ? old : verified.length ? verified : features.filter((f) => f.properties.status === 'independent');
  const named = pool.length ? pick(rng, pool) : null;
  const name: Hint = {
    id: 'name',
    title: 'A name on the map',
    text: named
      ? `One of the names printed on this map is “${named.properties.name}”${named.properties.nameInfo.official ? ` (officially ${named.properties.nameInfo.official})` : ''}.`
      : 'No state on this map has a name that narrows the date.',
  };

  // 4. a dated event: the one with the shortest bounded period that contains the reference date
  const candidates = HISTORICAL_EVENTS.filter((e) => e.omissionRisk !== 'high' && containsDate(e.valid, challenge.refDate)).map((e) => {
    const r = e.valid.find((v) => containsDate([v], challenge.refDate))!;
    const bounded = r.start !== null && r.end !== null;
    const width = bounded ? Number(r.end!.slice(0, 4)) - Number(r.start!.slice(0, 4)) : r.start !== null || r.end !== null ? 1000 : 2000;
    return { e, r, width };
  });
  candidates.sort((a, b) => a.width - b.width);
  const top = candidates.find((c) => c.width < 1000) ?? null;
  const tight = eraWindow(startYear, endYear, 20);
  const clue: Hint = {
    id: 'clue',
    title: 'A dated clue',
    text: top
      ? `A globe that shows “${top.e.title.replace(/^(Shows|Labels) /, '')}” is up to date for ${describeRanges([top.r], 'earlier times')}.`
      : `No single recorded event pins this map down. The date lies between ${tight.from} and ${tight.to}.`,
  };

  return [era, states, name, clue].slice(0, DIFFICULTIES[challenge.difficulty].maxHints);
}
