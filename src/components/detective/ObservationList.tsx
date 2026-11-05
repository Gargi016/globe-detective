import { useState } from 'react';
import EventDetails from './EventDetails';
import { CERTAINTIES } from '../../detective/investigation';
import type { InvestigationObservation, ObservationPatch } from '../../detective/investigation';
import { clueIdOf, observationToClue } from '../../detective/investigation';
import { getEvent } from '../../detective/historicalEvents';
import { describeRanges } from '../../detective/dateRange';
import { CATEGORY_LABEL } from '../../detective/types';
import type { Certainty } from '../../detective/clues';
import type { HistoricalEvent } from '../../detective/types';

export type ClueRole = 'sets-earliest' | 'sets-latest' | 'sets-both' | 'consistent';

export interface ObservationListProps {
  observations: readonly InvestigationObservation[];
  /** Clue ids that appear in a contradiction. */
  conflicting: ReadonlySet<string>;
  /** Roles from the latest estimate; null before one has been run or when it is out of date. */
  roles: ReadonlyMap<string, ClueRole> | null;
  onUpdate: (id: string, patch: ObservationPatch) => string | null;
  onRemove: (id: string) => void;
  onShowOnGlobe: (event: HistoricalEvent) => void;
}

const ROLE_TEXT: Record<ClueRole, string> = {
  'sets-earliest': 'Decides the earliest date',
  'sets-latest': 'Decides the latest date',
  'sets-both': 'Decides both ends of the range',
  consistent: 'Consistent, but does not narrow the range',
};

const CERT_LABEL: Record<Certainty, string> = { certain: 'Sure', probable: 'Probably', uncertain: 'Not sure' };

function Card({ o, conflict, role, onUpdate, onRemove, onShowOnGlobe }: { o: InvestigationObservation; conflict: boolean; role: ClueRole | null } & Omit<ObservationListProps, 'observations' | 'conflicting' | 'roles'>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearText, setYearText] = useState(o.printedYear === undefined ? '' : String(o.printedYear));
  const clue = observationToClue(o);
  const event = o.source === 'event' && o.eventId ? getEvent(o.eventId) : undefined;
  const update = (patch: ObservationPatch) => setError(onUpdate(o.id, patch));

  return (
    <li className={`evidence${conflict ? ' evidence--conflict' : ''}`}>
      {conflict && <span className="stamp" aria-label="This clue is part of a contradiction">Contradiction</span>}
      <header className="evidence__head">
        {event ? <span className={`cat cat--${event.category}`}>{CATEGORY_LABEL[event.category]}</span> : <span className="cat cat--printed">Printed date</span>}
        <h4 className="evidence__title">{clue?.label ?? 'Unknown observation'}</h4>
      </header>

      {o.source === 'event' ? (
        <div className="seg seg--small" role="group" aria-label="What the globe shows">
          <button type="button" className={`seg__btn${o.observation === 'shows' ? ' is-active' : ''}`} aria-pressed={o.observation === 'shows'} onClick={() => update({ observation: 'shows' })}>
            Shown on globe
          </button>
          <button type="button" className={`seg__btn${o.observation === 'absent' ? ' is-active' : ''}`} aria-pressed={o.observation === 'absent'} onClick={() => update({ observation: 'absent' })}>
            Missing from globe
          </button>
        </div>
      ) : (
        <div className="printed__row">
          <label className="field">
            <span className="field__label">Year</span>
            <input
              className="select"
              inputMode="numeric"
              maxLength={4}
              value={yearText}
              onChange={(e) => {
                setYearText(e.target.value);
                if (/^\d{4}$/.test(e.target.value)) update({ printedYear: Number(e.target.value) });
                else setError('Enter a four-digit year.');
              }}
            />
          </label>
          <label className="field">
            <span className="field__label">It says</span>
            <select className="select" value={o.printedMeaning ?? 'copyright'} onChange={(e) => update({ printedMeaning: e.target.value as 'copyright' | 'corrected-to' })}>
              <option value="copyright">© / edition year</option>
              <option value="corrected-to">“Corrected to” year</option>
            </select>
          </label>
        </div>
      )}

      {clue && (
        <p className="evidence__when">
          Points to map content from <strong>{describeRanges(clue.contentRanges, 'earlier times')}</strong>
          {clue.manufactureRanges && (
            <>
              {' '}
              and a globe made <strong>{describeRanges(clue.manufactureRanges)}</strong>
            </>
          )}
          .
        </p>
      )}

      <div className="evidence__row">
        <label className="field field--inline">
          <span className="field__label">Certainty</span>
          <select className="select" value={o.certainty} onChange={(e) => update({ certainty: e.target.value as Certainty })}>
            {CERTAINTIES.map((c) => (
              <option key={c} value={c}>
                {CERT_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        {clue && (
          <div className="meter meter--small" title={`Evidence weight ${(clue.reliability * 100).toFixed(0)}%`}>
            <span className="meter__label">Evidence weight</span>
            <span className="meter__track"><span className="meter__fill" style={{ width: `${Math.round(clue.reliability * 100)}%` }} /></span>
            <span className="meter__value">{Math.round(clue.reliability * 100)}%</span>
          </div>
        )}
      </div>

      <label className="field">
        <span className="field__label">Your note</span>
        <input className="select" maxLength={280} placeholder="Where on the globe, how it is spelled…" value={o.note ?? ''} onChange={(e) => update({ note: e.target.value })} />
      </label>

      {role && <p className={`evidence__role evidence__role--${role}`}>{ROLE_TEXT[role]}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="evidence__actions">
        {event && (
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide evidence' : 'Show evidence'}
          </button>
        )}
        {event && (
          <button type="button" className="btn btn--small btn--ghost" onClick={() => onShowOnGlobe(event)}>
            Show on globe
          </button>
        )}
        <button type="button" className="btn btn--small btn--danger" onClick={() => onRemove(o.id)}>
          Remove
        </button>
      </div>
      {open && event && <EventDetails event={event} />}
    </li>
  );
}

/** The case file: one evidence card per observation. */
export default function ObservationList({ observations, conflicting, roles, onUpdate, onRemove, onShowOnGlobe }: ObservationListProps) {
  if (observations.length === 0) {
    return (
      <div className="panel__empty">
        <div className="panel__empty-mark" aria-hidden="true">✦</div>
        <h2 className="panel__empty-title">The case file is empty</h2>
        <p>Use Search to find a name on your globe and record whether it is shown or missing. Or load an example from the Cases tab.</p>
      </div>
    );
  }
  return (
    <ol className="evidence-list">
      {observations.map((o) => {
        const cid = clueIdOf(o);
        return (
          <Card
            key={o.id}
            o={o}
            conflict={cid !== null && conflicting.has(cid)}
            role={cid !== null && roles ? (roles.get(cid) ?? null) : null}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onShowOnGlobe={onShowOnGlobe}
          />
        );
      })}
    </ol>
  );
}
