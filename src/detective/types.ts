import type { IsoDate, SourceRef } from '../history/types';

export type { IsoDate, SourceRef };

/**
 * An inclusive span of calendar days. `null` means "no bound on that side".
 * Spans are always compared as whole days; there is no time of day.
 */
export interface DateRange {
  start: IsoDate | null;
  end: IsoDate | null;
}

/** The seven kinds of evidence a globe can give about its own date. */
export type EventCategory =
  | 'existence' // a state or entity is shown as existing
  | 'disappearance' // an entity that later ceased to exist is shown, or its successors are
  | 'renaming' // a name that was in use only for a period
  | 'division' // a political partition / union is shown
  | 'independence' // a newly independent state is shown
  | 'boundary-change' // a border or sovereignty change is shown
  | 'capital-change'; // a capital city or its name changed

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'existence',
  'disappearance',
  'renaming',
  'division',
  'independence',
  'boundary-change',
  'capital-change',
];

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  existence: 'Country existence',
  disappearance: 'Country disappearance',
  renaming: 'Country renaming',
  division: 'Political division',
  independence: 'Independence',
  'boundary-change': 'Boundary change',
  'capital-change': 'Capital change',
};

/**
 * How well the dates of an event are established.
 *  - `documented`: a day-level date that standard references agree on.
 *  - `approximate`: the date is only known to the month or year, is contested, or the event was gradual
 *    (for example a de facto change that preceded the formal one).
 */
export type EvidenceQuality = 'documented' | 'approximate';

export type DatePrecision = 'day' | 'month' | 'year';

/**
 * How likely it is that a globe that is *current* for a date still leaves this thing out.
 * Used only when the globe is observed NOT to show something: a globe can lack a small state because of its
 * size, not its date, so absence is weaker evidence than presence.
 */
export type OmissionRisk = 'low' | 'medium' | 'high';

/**
 * One curated historical fact. `valid` lists every period during which a globe that is up to date would
 * depict this fact; the single-day `eventDate` is the transition that defines the nearest bound.
 */
export interface HistoricalEvent {
  id: string;
  category: EventCategory;
  /** The thing the event is about, e.g. "Ceylon". */
  subject: string;
  /** Short statement of what a globe that shows this is displaying. */
  title: string;
  /** What happened and when, in one or two sentences. Shown as reasoning. */
  description: string;
  /** Periods in which the depiction is correct. `null` bounds are open (see `openStartNote`). */
  valid: DateRange[];
  /** The date of the transition that fixes the (nearest) bound, for display. */
  eventDate: IsoDate;
  precision: DatePrecision;
  quality: EvidenceQuality;
  /** Why a bound is open, when it is (e.g. the name "Ceylon" was used long before 1886). */
  openStartNote?: string;
  /** Names a user might type or a globe might carry. Lower-case matching is done by the caller. */
  aliases: string[];
  omissionRisk: OmissionRisk;
  /** Events in the same group describe mutually exclusive depictions of the same thing (old/new name). */
  group?: string;
  /** Optional GW (Gleditsch–Ward) code linking the event to the Phase 3 historical map data. */
  gw?: number;
  sources: SourceRef[];
  /** Caveats about the dates. */
  notes?: string;
}

/** Whether the observer sees the fact on the globe, or notices that it is missing. */
export type Observation = 'shows' | 'absent';

/**
 * An observation about a globe, translated into constraints on dates.
 *
 * `contentRanges` constrain the date of the geographical *information* the globe depicts (the publication
 * date of its map content). `manufactureRanges`, when present, constrain the date the object was *made*
 * directly; most clues leave it undefined, because content only bounds manufacture indirectly (see
 * dateEstimator).
 */
export interface Clue {
  id: string;
  kind: 'event' | 'printed-date';
  eventId?: string;
  category?: EventCategory;
  observation: Observation;
  label: string;
  contentRanges: DateRange[];
  manufactureRanges?: DateRange[];
  /** 0..1: how much the clue's evidence can be trusted. */
  reliability: number;
  quality: EvidenceQuality;
  /** Plain-language reason, quoted in the estimate's reasoning. */
  reasoning: string;
  sources: SourceRef[];
  /** True when this clue rests on something being absent from the globe. */
  isAbsence: boolean;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceFactor {
  id: 'range-width' | 'evidence-quality' | 'corroboration' | 'absence-evidence' | 'conflict' | 'assumption' | 'knife-edge';
  label: string;
  /** 0..1 contribution before weighting. */
  score: number;
  detail: string;
}

export interface Confidence {
  level: ConfidenceLevel;
  /** 0..1. A rough, explainable indicator, not a probability. */
  score: number;
  factors: ConfidenceFactor[];
}

export interface Conflict {
  /** Clue ids forming a minimal set that cannot all be true together. */
  clueIds: string[];
  message: string;
  /** For two clues whose ranges simply do not meet: the number of whole days between them, else null. */
  gapDays: number | null;
  possibleExplanations: string[];
}

export interface ReasoningStep {
  clueId: string;
  label: string;
  text: string;
  effect: 'narrows' | 'no-change' | 'conflict' | 'sets-start';
  /** Running intersection after this clue (information date). */
  rangeAfter: DateRange[];
}

export type EstimateStatus = 'ok' | 'no-clues' | 'contradictory';

export interface AssumptionSet {
  /** Years a globe may have been made after its map content was current (reused plates, stock). */
  reuseLagYears: number;
  earliestPlausible: IsoDate;
  today: IsoDate;
}

export interface RangeSummary {
  ranges: DateRange[];
  /** e.g. "30 Dec 1922 – 26 Dec 1991" or "from 26 Mar 1971 (no later bound)". */
  text: string;
  /** Width in whole years once open ends are capped by the assumptions; null if there is no range. */
  widthYears: number | null;
}

export interface AlternativeReading {
  /** Clues kept in this reading, with those left out listed in `droppedClueIds`. */
  keptClueIds: string[];
  droppedClueIds: string[];
  information: RangeSummary;
}

export interface Estimate {
  status: EstimateStatus;
  /** Date of the geographical information on the globe: when its map content was current. */
  information: RangeSummary | null;
  /** Date the globe was most likely made: while its content was current. */
  manufactureLikely: RangeSummary | null;
  /** Wider window allowing for globes made after their content was current (plates reused). */
  manufacturePossible: RangeSummary | null;
  confidence: { information: Confidence; manufacture: Confidence };
  reasoning: ReasoningStep[];
  /** Clues that actually fixed an end of the information range (the range widens if they are removed). */
  bindingClueIds: string[];
  conflicts: Conflict[];
  /** When clues contradict: consistent readings obtained by leaving some clues out. */
  alternatives: AlternativeReading[];
  invalidClues: { clueId: string; problems: string[] }[];
  assumptions: AssumptionSet;
  caveats: string[];
  headline: string;
}

export interface EstimateOptions {
  reuseLagYears?: number;
  earliestPlausible?: IsoDate;
  /** Injectable for deterministic tests; defaults to the current date. */
  today?: IsoDate;
}
