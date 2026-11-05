import ConfidenceMeter from './ConfidenceMeter';
import RangeBar from './RangeBar';
import SourceLinks from '../history/SourceLinks';
import { yearSpanText } from '../../detective/dateEstimator';
import type { Estimate } from '../../detective/types';
import type { InvestigationObservation } from '../../detective/investigation';
import { clueIdOf, observationToClue } from '../../detective/investigation';
import { getEvent } from '../../detective/historicalEvents';

export interface EstimatePanelProps {
  estimate: Estimate | null;
  stale: boolean;
  observations: readonly InvestigationObservation[];
  reuseLagYears: number;
  onLagChange: (years: number) => void;
  onRun: () => void;
  canRun: boolean;
  onShowPeriod: () => void;
  canShowPeriod: boolean;
  onKeepOnly: (clueIds: string[]) => void;
  onRemoveClue: (clueId: string) => void;
}

const EFFECT_LABEL: Record<Estimate['reasoning'][number]['effect'], string> = {
  'sets-start': 'Starts the range',
  narrows: 'Narrows the range',
  'no-change': 'No further narrowing',
  conflict: 'Contradiction',
};

export default function EstimatePanel(props: EstimatePanelProps) {
  const { estimate, stale, observations, reuseLagYears } = props;
  const labelOf = (clueId: string) => {
    const o = observations.find((x) => clueIdOf(x) === clueId);
    return (o && observationToClue(o)?.label) || clueId;
  };
  const sourcesFor = (clueId: string) => {
    const o = observations.find((x) => clueIdOf(x) === clueId);
    const ev = o?.eventId ? getEvent(o.eventId) : undefined;
    return ev?.sources ?? [];
  };

  const lagControl = (
    <label className="field field--inline">
      <span className="field__label">Years a globe may be made after its map was current</span>
      <input
        className="select select--number"
        type="number"
        min={0}
        max={100}
        value={reuseLagYears}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n) && n >= 0 && n <= 100) props.onLagChange(n);
        }}
        aria-describedby="lag-help"
      />
    </label>
  );

  if (!estimate) {
    return (
      <div className="estimate estimate--empty">
        <h2 className="panel__empty-title">No estimate yet</h2>
        <p className="muted">
          Add observations to the case file, then run the estimate. It intersects the date range each clue supports and shows its reasoning.
        </p>
        {lagControl}
        <p id="lag-help" className="muted">An adjustable assumption: globes were often made from older plates. It widens the “possibly made” window only.</p>
        <button type="button" className="btn" onClick={props.onRun} disabled={!props.canRun}>
          Run estimate
        </button>
        {!props.canRun && <p className="muted">Add at least one observation first.</p>}
      </div>
    );
  }

  return (
    <div className="estimate">
      {stale && (
        <div className="notice notice--warn" role="status">
          <strong>Out of date.</strong> The case file changed after this estimate was run.
          <button type="button" className="btn btn--small" onClick={props.onRun} disabled={!props.canRun}>
            Run again
          </button>
        </div>
      )}

      <div className={stale ? 'is-stale' : undefined}>
        {estimate.status === 'no-clues' && <p className="muted">{estimate.headline}</p>}

        {estimate.status === 'contradictory' && (
          <>
            <div className="notice notice--bad" role="alert">
              <strong>No date fits every clue.</strong> {estimate.headline}
            </div>
            <ul className="conflicts">
              {estimate.conflicts.map((c) => (
                <li key={c.clueIds.join('+')} className="conflict">
                  <p>{c.message}</p>
                  <ul className="conflict__who">
                    {c.clueIds.map((id) => (
                      <li key={id}>
                        {labelOf(id)}{' '}
                        <button type="button" className="btn btn--small btn--danger" onClick={() => props.onRemoveClue(id)}>
                          Remove this clue
                        </button>
                      </li>
                    ))}
                  </ul>
                  <details>
                    <summary>Possible explanations</summary>
                    <ul>{c.possibleExplanations.map((x) => <li key={x}>{x}</li>)}</ul>
                  </details>
                </li>
              ))}
            </ul>
            {estimate.alternatives.length > 0 && (
              <section>
                <h3 className="desk__h3">Consistent readings if some clues are left out</h3>
                <ul className="alternatives">
                  {estimate.alternatives.map((a) => (
                    <li key={a.keptClueIds.join('+')} className="alternative">
                      <p>
                        Keep: {a.keptClueIds.map(labelOf).join('; ')}
                        <br />
                        <strong>{a.information.text}</strong>
                        {a.information.widthYears !== null && <span className="muted"> (about {a.information.widthYears < 10 ? a.information.widthYears.toFixed(1) : Math.round(a.information.widthYears)} years)</span>}
                      </p>
                      <button type="button" className="btn btn--small" onClick={() => props.onKeepOnly(a.keptClueIds)}>
                        Use this reading (removes the others)
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {estimate.status === 'ok' && estimate.information && (
          <>
            <section className="verdict" aria-label="Estimated date range">
              <p className="verdict__eyebrow">Map content from</p>
              <p className="verdict__range">{yearSpanText(estimate.information.ranges)}</p>
              <p className="verdict__exact">{estimate.information.text}</p>
              {estimate.manufactureLikely && (
                <p className="verdict__line">
                  <span>Most likely made</span> <strong>{yearSpanText(estimate.manufactureLikely.ranges)}</strong>
                </p>
              )}
              {estimate.manufacturePossible && (
                <p className="verdict__line">
                  <span>Possibly as late as</span> <strong>{yearSpanText(estimate.manufacturePossible.ranges)}</strong>
                </p>
              )}
              <p className="verdict__note">A range, not a manufacturing year. The map content date and the date the globe was made are different things.</p>
            </section>

            <RangeBar
              information={estimate.information.ranges}
              likely={estimate.manufactureLikely?.ranges ?? null}
              possible={estimate.manufacturePossible?.ranges ?? null}
              today={estimate.assumptions.today}
              earliest={estimate.assumptions.earliestPlausible}
            />

            <div className="estimate__confidence">
              <ConfidenceMeter title="Confidence in the map-content date" confidence={estimate.confidence.information} />
              <ConfidenceMeter title="Confidence in the manufacture date" confidence={estimate.confidence.manufacture} />
            </div>

            <button type="button" className="btn btn--ghost" onClick={props.onShowPeriod} disabled={!props.canShowPeriod} title={props.canShowPeriod ? 'Move the reference globe into this period' : 'The reference globe only covers 1886–2019'}>
              Show this period on the globe
            </button>
            {!props.canShowPeriod && <span className="muted"> The reference globe covers 1886–2019 only.</span>}
          </>
        )}

        {estimate.reasoning.length > 0 && (
          <section>
            <h3 className="desk__h3">The reasoning, clue by clue</h3>
            <ol className="reasoning">
              {estimate.reasoning.map((s, i) => (
                <li key={s.clueId} className={`reasoning__step reasoning__step--${s.effect}`}>
                  <header>
                    <span className="reasoning__n">{i + 1}</span>
                    <strong>{labelOf(s.clueId)}</strong>
                    <span className="reasoning__effect">{EFFECT_LABEL[s.effect]}</span>
                    {estimate.bindingClueIds.includes(s.clueId) && <span className="reasoning__binding">Deciding clue</span>}
                  </header>
                  <p>{s.text}</p>
                  <SourceLinks sources={sourcesFor(s.clueId)} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {estimate.invalidClues.length > 0 && (
          <div className="notice notice--warn">
            <strong>Ignored:</strong> {estimate.invalidClues.map((c) => `${c.clueId} (${c.problems.join('; ')})`).join('; ')}
          </div>
        )}

        {estimate.caveats.length > 0 && (
          <section>
            <h3 className="desk__h3">Limits of this estimate</h3>
            <ul className="caveats">{estimate.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
        )}

        <section className="assumptions">
          <h3 className="desk__h3">Assumption</h3>
          {lagControl}
          <p id="lag-help" className="muted">Used for the “possibly made” window only. Change it, then run the estimate again.</p>
          <button type="button" className="btn btn--small" onClick={props.onRun} disabled={!props.canRun}>
            Run estimate again
          </button>
        </section>
      </div>
    </div>
  );
}
