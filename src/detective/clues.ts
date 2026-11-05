import { CATEGORY_LABEL } from './types';
import type { Clue, EvidenceQuality, HistoricalEvent, Observation, OmissionRisk, SourceRef } from './types';
import { complement, describeRanges, isValidIsoDate, normalize } from './dateRange';
import { getEvent, HISTORICAL_EVENTS } from './historicalEvents';

/**
 * Clues: observations about a globe, translated into constraints on dates.
 *
 * Two kinds of date are kept apart throughout:
 *  - the date of the geographical INFORMATION the globe shows (when its map content was current), and
 *  - the date the object was MANUFACTURED.
 * A clue about what the globe depicts constrains the first directly. It constrains the second only
 * indirectly, through the estimator's assumption that a globe is made no earlier than its content and
 * possibly some years later (plates and stock were reused). Only a printed date gives a direct handle on
 * manufacture, and even then it is a lower bound.
 */

/** How sure the observer is that they read the globe correctly. */
export type Certainty = 'certain' | 'probable' | 'uncertain';

export const CERTAINTY_FACTOR: Record<Certainty, number> = { certain: 1, probable: 0.8, uncertain: 0.5 };

/** Evidence-quality weights. A date known to the day from standard references beats an approximate one. */
export const QUALITY_FACTOR: Record<EvidenceQuality, number> = { documented: 1, approximate: 0.75 };

/**
 * Absence is weaker than presence: a globe may omit a state because it is small or contested, not because it
 * did not exist. These factors multiply the reliability of an absence clue.
 */
export const OMISSION_FACTOR: Record<OmissionRisk, number> = { low: 0.8, medium: 0.55, high: 0.3 };

export interface ClueOptions {
  certainty?: Certainty;
}

export function clueId(observation: Observation, eventId: string): string {
  return `${observation}:${eventId}`;
}

/** Build a clue from a database event and an observation. Throws if the event id is unknown. */
export function createClue(eventId: string, observation: Observation, options: ClueOptions = {}): Clue {
  const event = getEvent(eventId);
  if (!event) throw new Error(`Unknown historical event "${eventId}"`);
  return clueFromEvent(event, observation, options);
}

export function clueFromEvent(event: HistoricalEvent, observation: Observation, options: ClueOptions = {}): Clue {
  const certainty = CERTAINTY_FACTOR[options.certainty ?? 'certain'];
  const quality = QUALITY_FACTOR[event.quality];
  const valid = normalize(event.valid);

  if (observation === 'shows') {
    return {
      id: clueId('shows', event.id),
      kind: 'event',
      eventId: event.id,
      category: event.category,
      observation,
      label: event.title,
      contentRanges: valid,
      reliability: round(certainty * quality),
      quality: event.quality,
      isAbsence: false,
      sources: event.sources,
      reasoning:
        `${event.description} A globe that shows this carries geographical information from ${describeRanges(valid, 'earlier times')}.` +
        (event.openStartNote ? ` ${event.openStartNote}` : '') +
        (event.notes ? ` Note: ${event.notes}` : ''),
    };
  }

  const absentRanges = complement(valid);
  return {
    id: clueId('absent', event.id),
    kind: 'event',
    eventId: event.id,
    category: event.category,
    observation,
    label: `Does not show: ${event.title.replace(/^(Shows|Labels) /, '')}`,
    contentRanges: absentRanges,
    reliability: round(certainty * quality * OMISSION_FACTOR[event.omissionRisk]),
    quality: event.quality,
    isAbsence: true,
    sources: event.sources,
    reasoning:
      `${event.description} A globe that lacks it points to ${describeRanges(absentRanges, 'earlier times')}. ` +
      `Absence is weaker evidence than presence (omission risk for this item: ${event.omissionRisk}): small, contested or crowded features are often left off a globe whatever its date.`,
  };
}

export type PrintedDateMeaning = 'copyright' | 'corrected-to';

export interface PrintedDateInput extends ClueOptions {
  year: number;
  meaning?: PrintedDateMeaning;
}

const PRINTED_DATE_SOURCE: SourceRef[] = [];

/**
 * A date printed on the globe (copyright line, edition, “corrected to …”).
 *
 * It bounds the information date from ABOVE (a globe cannot depict events after the date printed on it) and
 * the manufacture date from BELOW (the object is not older than its own printed date). It does not say the globe
 * was made in that year: later impressions often kept the original date.
 */
export function createPrintedDateClue(input: PrintedDateInput): Clue {
  const { year } = input;
  if (!Number.isInteger(year) || year < 1400 || year > 9999) throw new Error(`Printed year ${year} is not a plausible year`);
  const meaning: PrintedDateMeaning = input.meaning ?? 'copyright';
  const certainty = CERTAINTY_FACTOR[input.certainty ?? 'certain'];
  const y = String(year).padStart(4, '0');
  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  const what =
    meaning === 'copyright'
      ? `The globe carries the printed date ${year} (a copyright or edition date)`
      : `The globe says its map is corrected to ${year}`;
  return {
    id: `printed:${meaning}:${year}`,
    kind: 'printed-date',
    observation: 'shows',
    label: meaning === 'copyright' ? `Printed date ${year}` : `Corrected to ${year}`,
    contentRanges: [{ start: null, end: end }],
    manufactureRanges: [{ start, end: null }],
    // A printed date is not an official-record date, but it is the globe's own statement, so it counts as documented evidence.
    reliability: round(certainty * (meaning === 'copyright' ? 0.8 : 0.7)),
    quality: 'documented',
    isAbsence: false,
    sources: PRINTED_DATE_SOURCE,
    reasoning:
      `${what}. The map content therefore cannot be later than ${year}. ` +
      `The globe itself is normally not older than ${year}, but may be a later impression that kept the original date, so ${year} is a lower bound on manufacture, not an estimate of it.`,
  };
}

// ---------- discovery helpers for UIs -------------------------------------------------------------

export interface ClueTemplate {
  eventId: string;
  category: HistoricalEvent['category'];
  categoryLabel: string;
  subject: string;
  title: string;
  aliases: string[];
}

/** One template per event; the UI offers “shows” and “absent” for each. */
export function listClueTemplates(): ClueTemplate[] {
  return HISTORICAL_EVENTS.map((e) => ({
    eventId: e.id,
    category: e.category,
    categoryLabel: CATEGORY_LABEL[e.category],
    subject: e.subject,
    title: e.title,
    aliases: e.aliases,
  }));
}

/** Build clues from several observations at once; ignores nothing, so unknown ids still throw. */
export function createClues(observations: { eventId: string; observation: Observation; certainty?: Certainty }[]): Clue[] {
  return observations.map((o) => createClue(o.eventId, o.observation, { certainty: o.certainty }));
}

/** Basic structural check used by tests and validation. */
export function hasValidPrintedYear(clue: Clue): boolean {
  if (clue.kind !== 'printed-date') return true;
  return clue.contentRanges.every((r) => (r.end === null || isValidIsoDate(r.end)) && (r.start === null || isValidIsoDate(r.start)));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
