import type {
  AlternativeReading,
  AssumptionSet,
  Clue,
  Confidence,
  ConfidenceFactor,
  ConfidenceLevel,
  DateRange,
  Estimate,
  EstimateOptions,
  RangeSummary,
  ReasoningStep,
} from './types';
import {
  clamp,
  describeRanges,
  extendEnds,
  intersect,
  intersectAll,
  isEmpty,
  normalize,
  sameRanges,
  todayIso,
  widthYears,
} from './dateRange';
import { dedupe, findConflicts, maximalConsistentSubsets, validateClue } from './clueValidation';

/**
 * Date estimation.
 *
 * The estimator answers two different questions and never mixes them up:
 *
 *  1. INFORMATION DATE: when was the geographical content of the globe current? Every clue gives a set of
 *     date ranges in which the observed depiction is correct. The information range is their intersection.
 *
 *  2. MANUFACTURE DATE: when was the object made? A globe cannot be made before its content, so the content
 *     range is the *likely* manufacture window. Globes were often made years after their map content was
 *     compiled (stock and plates were reused), so the *possible* window extends the end of the content range
 *     by `reuseLagYears`. That figure is an adjustable planning assumption, not a measured statistic, and it
 *     is reported with every estimate. A printed date, if any, gives a lower bound on manufacture directly.
 *
 * The result is always a range with the reasoning behind it, never a single year.
 */

export const DEFAULT_REUSE_LAG_YEARS = 10;
export const DEFAULT_EARLIEST_PLAUSIBLE = '1492-01-01'; // the oldest surviving terrestrial globe, Behaim’s Erdapfel

export function resolveAssumptions(options: EstimateOptions = {}): AssumptionSet {
  return {
    reuseLagYears: options.reuseLagYears ?? DEFAULT_REUSE_LAG_YEARS,
    earliestPlausible: options.earliestPlausible ?? DEFAULT_EARLIEST_PLAUSIBLE,
    today: options.today ?? todayIso(),
  };
}

// ---------- confidence ----------------------------------------------------------------------------

const WEIGHTS = { width: 0.35, evidence: 0.25, corroboration: 0.25, absence: 0.15 } as const;

/** 1 for a range of a year or two, falling to near 0 for ranges of a century or more. */
export function widthScore(years: number | null): number {
  if (years === null) return 0;
  if (years <= 1) return 1;
  if (years <= 3) return 0.9;
  if (years <= 5) return 0.8;
  if (years <= 10) return 0.65;
  if (years <= 25) return 0.45;
  if (years <= 50) return 0.25;
  if (years <= 100) return 0.1;
  return 0.03;
}

const levelOf = (score: number): ConfidenceLevel => (score >= 0.7 ? 'high' : score >= 0.45 ? 'medium' : 'low');

const NO_CONFIDENCE: Confidence = { level: 'none', score: 0, factors: [] };

const fmtYears = (y: number | null) => (y === null ? 'no range' : y < 1 ? 'under a year' : `about ${y < 10 ? y.toFixed(1) : Math.round(y)} years`);

export function computeConfidence(input: {
  width: number | null;
  binding: Clue[];
  relyOnReuseLag: boolean;
  manufacture: boolean;
}): Confidence {
  const { width, binding } = input;
  const factors: ConfidenceFactor[] = [];

  const wScore = widthScore(width);
  factors.push({
    id: 'range-width',
    label: 'How narrow the range is',
    score: wScore,
    detail: `The range spans ${fmtYears(width)}.${width !== null && width > 50 ? ' A range this wide says little.' : ''}`,
  });

  const evidence = binding.length === 0 ? 0 : binding.reduce((s, c) => s + c.reliability, 0) / binding.length;
  factors.push({
    id: 'evidence-quality',
    label: 'Quality of the evidence that sets the range',
    score: round(evidence),
    detail:
      binding.length === 0
        ? 'No clue narrows the range.'
        : `Average reliability of the ${binding.length} deciding clue${binding.length === 1 ? '' : 's'}: ${(evidence * 100).toFixed(0)}% (documented day-level dates, certainty of reading, and omission risk for absences).`,
  });

  const categories = new Set(binding.map((c) => c.category ?? c.kind));
  const corr = binding.length === 0 ? 0 : binding.length === 1 ? 0.4 : binding.length === 2 ? 0.75 : 1;
  const corrScore = Math.min(1, corr + (categories.size > 1 && binding.length > 1 ? 0.1 : 0));
  factors.push({
    id: 'corroboration',
    label: 'Independent clues that agree',
    score: round(corrScore),
    detail:
      binding.length === 0
        ? 'Nothing corroborates the range.'
        : binding.length === 1
          ? 'The range rests on a single deciding clue.'
          : `${binding.length} clues each fix part of the range${categories.size > 1 ? ', from different kinds of evidence' : ''}.`,
  });

  const absentShare = binding.length === 0 ? 0 : binding.filter((c) => c.isAbsence).length / binding.length;
  const absScore = 1 - 0.7 * absentShare;
  factors.push({
    id: 'absence-evidence',
    label: 'Reliance on things missing from the globe',
    score: round(absScore),
    detail: absentShare === 0 ? 'No deciding clue relies on something being absent.' : `${Math.round(absentShare * 100)}% of the deciding clues are absences, which are weaker than things seen.`,
  });

  factors.push({
    id: 'conflict',
    label: 'Contradictions',
    score: 1,
    detail: 'The clues used are consistent with each other.',
  });

  let score =
    WEIGHTS.width * wScore + WEIGHTS.evidence * evidence + WEIGHTS.corroboration * corrScore + WEIGHTS.absence * absScore;

  const order: ConfidenceLevel[] = ['low', 'medium', 'high'];
  const capAt = (cap: ConfidenceLevel) => {
    if (order.indexOf(level) > order.indexOf(cap)) level = cap;
  };
  let level = levelOf(score);
  // A single deciding clue, or a range that is still a decade wide, can never be called high.
  if (binding.length < 2 || (width !== null && width > 10)) capAt('medium');
  // A very wide range says little however good the evidence: over 25 years is at best medium, over 50 low.
  if (width !== null && width > 50) capAt('low');
  else if (width !== null && width > 25) capAt('medium');
  // A range only days wide produced by clues whose dates merely touch is fragile: a day's difference in how
  // either date is coded would turn it into a contradiction.
  if (width !== null && width < 0.25) {
    factors.push({
      id: 'knife-edge',
      label: 'Range only days or weeks wide',
      score: 0.5,
      detail: 'The clues barely overlap. A one-day difference in how either date is coded would make them contradict, so this is treated with caution.',
    });
    score *= 0.75;
    capAt('medium');
  }

  if (input.manufacture) {
    const factor = input.relyOnReuseLag ? 0.8 : 1;
    factors.push({
      id: 'assumption',
      label: 'Assumption about reused map content',
      score: factor,
      detail: input.relyOnReuseLag
        ? 'The window depends on the assumption that a globe can be made some years after its content was current; that figure is a planning assumption, so manufacture is less certain than the content date.'
        : 'No later bound on the content was found, so no reuse assumption was needed.',
    });
    score *= factor;
    // Manufacture can never be rated higher than the content date it rests on, nor 'high' if it leans on the reuse assumption.
    capAt(levelOf(score));
    if (input.relyOnReuseLag) capAt('medium');
  }
  return { level, score: round(score), factors };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------- the estimator -------------------------------------------------------------------------

function summarize(ranges: DateRange[], a: AssumptionSet): RangeSummary {
  const r = normalize(ranges);
  return { ranges: r, text: describeRanges(r), widthYears: widthYears(r, a.earliestPlausible, a.today) };
}

/** “1949–1990”, “before 1972”, “after 1971” for headlines. */
export function yearSpanText(ranges: DateRange[]): string {
  const r = normalize(ranges);
  if (r.length === 0) return 'no date';
  return r
    .map((x) => {
      const s = x.start?.slice(0, 4);
      const e = x.end?.slice(0, 4);
      if (s && e) return s === e ? s : `${s}–${e}`;
      if (s) return `${s} or later`;
      if (e) return `${e} or earlier`;
      return 'any time';
    })
    .join(' or ');
}

function buildReasoning(clues: Clue[], base: DateRange[], a: AssumptionSet): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  let running = base;
  for (const c of clues) {
    const next = intersect(running, c.contentRanges);
    let effect: ReasoningStep['effect'];
    let rangeAfter: DateRange[];
    if (isEmpty(next)) {
      effect = 'conflict';
      rangeAfter = running;
    } else if (sameRanges(next, running)) {
      effect = 'no-change';
      rangeAfter = running;
    } else {
      effect = sameRanges(running, base) ? 'sets-start' : 'narrows';
      rangeAfter = next;
    }
    const tail =
      effect === 'conflict'
        ? 'This clue does not overlap the range left by the earlier ones: see the contradictions.'
        : effect === 'no-change'
          ? 'This clue does not narrow the range further.'
          : `Range now: ${describeRanges(rangeAfter)}.`;
    steps.push({ clueId: c.id, label: c.label, text: `${c.reasoning} ${tail}`, effect, rangeAfter });
    running = rangeAfter;
  }
  void a;
  return steps;
}

export function estimateDate(inputClues: Clue[], options: EstimateOptions = {}): Estimate {
  const assumptions = resolveAssumptions(options);
  const base: DateRange[] = [{ start: assumptions.earliestPlausible, end: assumptions.today }];

  const unique = dedupe(inputClues);
  const invalidClues: Estimate['invalidClues'] = [];
  const clues: Clue[] = [];
  for (const c of unique) {
    const v = validateClue(c);
    if (v.ok) clues.push(c);
    else invalidClues.push({ clueId: c.id, problems: v.problems });
  }

  const emptyConfidence = { information: NO_CONFIDENCE, manufacture: NO_CONFIDENCE };
  const common = { reasoning: [] as ReasoningStep[], bindingClueIds: [] as string[], conflicts: [], alternatives: [], invalidClues, assumptions };

  if (clues.length === 0) {
    return {
      ...common,
      status: 'no-clues',
      information: null,
      manufactureLikely: null,
      manufacturePossible: null,
      confidence: emptyConfidence,
      caveats: [],
      headline: invalidClues.length ? 'None of the clues could be used.' : 'Add clues about what the globe shows to estimate its date.',
    };
  }

  const reasoning = buildReasoning(clues, base, assumptions);
  const infoRanges = clamp(intersectAll([base, ...clues.map((c) => c.contentRanges)]), assumptions.earliestPlausible, assumptions.today);

  // ----- contradiction ---------------------------------------------------------------------------
  if (isEmpty(infoRanges)) {
    const conflicts = findConflicts(clues);
    const alternatives: AlternativeReading[] = maximalConsistentSubsets(clues, conflicts).map((kept) => {
      const keptClues = clues.filter((c) => kept.includes(c.id));
      const range = clamp(intersectAll(keptClues.map((c) => c.contentRanges)), assumptions.earliestPlausible, assumptions.today);
      return {
        keptClueIds: kept,
        droppedClueIds: clues.filter((c) => !kept.includes(c.id)).map((c) => c.id),
        information: summarize(range, assumptions),
      };
    });
    return {
      status: 'contradictory',
      information: null,
      manufactureLikely: null,
      manufacturePossible: null,
      confidence: emptyConfidence,
      reasoning,
      bindingClueIds: [],
      conflicts,
      alternatives,
      invalidClues,
      assumptions,
      caveats: [
        'No date satisfies every clue, so no estimate is given. Check the clues in each contradiction, or consider the alternative readings below, each of which leaves some clues out.',
      ],
      headline: `The clues contradict each other: ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} found, so no single date range fits.`,
    };
  }

  // ----- information date ------------------------------------------------------------------------
  const binding = clues.filter((c) => {
    const without = clues.filter((o) => o.id !== c.id);
    const alt = clamp(intersectAll([base, ...without.map((o) => o.contentRanges)]), assumptions.earliestPlausible, assumptions.today);
    return !sameRanges(alt, infoRanges);
  });
  const information = summarize(infoRanges, assumptions);

  // ----- manufacture date ------------------------------------------------------------------------
  const manufactureConstraint = intersectAll(clues.filter((c) => c.manufactureRanges).map((c) => c.manufactureRanges!));
  const likelyRanges = intersect(infoRanges, manufactureConstraint);
  const lagged = clamp(extendEnds(infoRanges, assumptions.reuseLagYears), assumptions.earliestPlausible, assumptions.today);
  const possibleRanges = intersect(lagged, manufactureConstraint);
  const hasUpperBound = infoRanges.some((r) => r.end !== null && r.end < assumptions.today);

  const caveats: string[] = [
    'The information range says when the globe’s map content was current. The globe may have been made later; see the manufacture ranges.',
  ];
  if (hasUpperBound) {
    caveats.push(
      `The “possible” manufacture window adds ${assumptions.reuseLagYears} years to the end of the information range, allowing for globes made from older plates or stock. That figure is an adjustable assumption, not a measured statistic.`,
    );
  }
  if (isEmpty(likelyRanges) && !isEmpty(possibleRanges)) {
    caveats.push('A printed date is later than the content range. The globe was probably made after its map content was current, using older plates.');
  }
  if (isEmpty(possibleRanges)) {
    caveats.push(
      `A printed date lies more than ${assumptions.reuseLagYears} years after the latest date the map content can have, which is longer than the reuse allowance. Either the globe reused very old content or one of the clues is wrong.`,
    );
  }
  if (binding.length === 1) caveats.push('The range rests on a single deciding clue; additional independent clues would strengthen it.');
  if (binding.some((c) => c.quality === 'approximate')) caveats.push('At least one deciding clue depends on a date that is approximate or gradual in reality.');
  if (binding.some((c) => c.isAbsence)) caveats.push('At least one deciding clue is something missing from the globe, which is weaker evidence than something present.');
  if (information.widthYears !== null && information.widthYears < 0.25) {
    caveats.push('The information range is only days or weeks wide because the clues’ dates barely touch; a one-day difference in how a date is coded would make them contradict.');
  }
  if (!hasUpperBound) caveats.push('Nothing bounds the date from above: any date up to today is possible on this evidence.');
  if (infoRanges.some((r) => r.start === assumptions.earliestPlausible)) caveats.push('Nothing bounds the date from below.');
  if (clues.some((c) => c.kind === 'printed-date')) {
    caveats.push('A printed date is the globe’s own claim; it often marks a first edition or copyright, not the year this globe was made.');
  }

  const likely = isEmpty(likelyRanges) ? null : summarize(likelyRanges, assumptions);
  const possible = isEmpty(possibleRanges) ? null : summarize(possibleRanges, assumptions);

  const confInfo = computeConfidence({ width: information.widthYears, binding, relyOnReuseLag: false, manufacture: false });
  const confMake = possible
    ? computeConfidence({ width: possible.widthYears, binding, relyOnReuseLag: hasUpperBound, manufacture: true })
    : NO_CONFIDENCE;

  const headline =
    `The map content dates from ${yearSpanText(infoRanges)}` +
    (likely ? `; the globe was most likely made ${yearSpanText(likelyRanges)}` : '') +
    (possible && hasUpperBound ? `, and possibly as late as ${yearSpanText(possibleRanges)}` : '') +
    `. Confidence: ${confInfo.level} for the content date, ${confMake.level} for manufacture.`;

  return {
    status: 'ok',
    information,
    manufactureLikely: likely,
    manufacturePossible: possible,
    confidence: { information: confInfo, manufacture: confMake },
    reasoning,
    bindingClueIds: binding.map((c) => c.id),
    conflicts: [],
    alternatives: [],
    invalidClues,
    assumptions,
    caveats,
    headline,
  };
}

