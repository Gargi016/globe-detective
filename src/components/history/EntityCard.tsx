import { useMemo } from 'react';
import type { HistoryService } from '../../history/historyService';
import { formatDate } from '../../history/historyService';
import { STATUS_LABEL } from '../../history/types';
import type { HistoricalFeature } from '../../history/types';
import { analyzeCountry, formatArea, formatLatLng } from '../../lib/geo';
import DataBadge from '../DataBadge';
import SourceLinks from './SourceLinks';

export interface EntityCardProps {
  service: HistoryService;
  gw: number;
  /** The polygon on the selected date, or null if the entity does not exist then. */
  feature: HistoricalFeature | null;
  date: string;
  onClose: () => void;
  onFocus: () => void;
  onJumpToYear: (year: number, gw: number) => void;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));

export default function EntityCard({ service, gw, feature, date, onClose, onFocus, onJumpToYear }: EntityCardProps) {
  const summary = service.summary(gw);
  const periods = service.periodsOf(gw);
  const allNotes = service.allNotesFor(gw);
  const activeNotes = service.notesFor(gw, date);

  const geo = useMemo(() => (feature ? analyzeCountry(feature) : null), [feature]);

  if (!summary) return null;

  const props = feature?.properties;
  const title = props?.name ?? summary.names[0];

  return (
    <div className="panel__body" key={`${gw}-${props?.fid ?? 'absent'}`}>
      <div className="panel__head">
        <div>
          <p className="eyebrow">Field notes</p>
          <h2 className="panel__title">{title}</h2>
          {props && props.nameInfo.official && <p className="panel__sub">{props.nameInfo.official}</p>}
        </div>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>

      {!feature && (
        <div className="callout callout--warn" role="status">
          <strong>Not present on {formatDate(date)}.</strong> CShapes has no polygon for this entity on that date. It
          appears in the data from {formatDate(summary.firstStart)} to {formatDate(summary.lastEnd)}
          {periods.length > 1 ? ' (with gaps)' : ''}.
        </div>
      )}

      {props && (
        <>
          <section className="panel__section">
            <h3 className="panel__h3">
              Name on this date{' '}
              <DataBadge kind={props.nameInfo.provenance === 'dataset' ? 'dataset' : props.nameInfo.provenance} />
            </h3>
            <p className="name-line">
              <strong>{props.name}</strong>
              {props.nameInfo.approximate && <span className="approx"> · start date approximate</span>}
            </p>
            {props.nameInfo.provenance === 'dataset' && (
              <p className="muted">
                No period-specific name is recorded for this state and date, so CShapes’ own label is shown. It may
                combine several historical names or use a present-day one.
              </p>
            )}
            {props.nameInfo.provenance === 'descriptive' && (
              <p className="muted">This is the project’s own description, not an official state name.</p>
            )}
            {props.nameInfo.note && <p className="muted">{props.nameInfo.note}</p>}
            {props.nameInfo.provenance !== 'dataset' && <SourceLinks sources={props.nameInfo.sources} />}
            {props.datasetLabel !== props.name && (
              <p className="muted">
                CShapes label: “{props.datasetLabel}”
              </p>
            )}
          </section>

          <section className="panel__section">
            <h3 className="panel__h3">
              Political status <DataBadge kind="dataset" />
            </h3>
            <dl className="facts">
              <Fact label="Status">{STATUS_LABEL[props.status]}</Fact>
              {props.ownerName && <Fact label="Controlled by">{props.ownerName}</Fact>}
              <Fact label="Polygon valid">
                {formatDate(props.start)} – {formatDate(props.end)}
              </Fact>
              <Fact label="Capital">{props.capital.name}</Fact>
              <Fact label="Boundaries">{props.boundaryDefined ? 'Defined' : 'Undefined (approximate)'}</Fact>
            </dl>
          </section>

          {geo && (
            <section className="panel__section">
              <h3 className="panel__h3">
                Geography <DataBadge kind="computed" />
              </h3>
              <dl className="facts">
                <Fact label="Area">{formatArea(props.areaKm2)}</Fact>
                <Fact label="Centre">{formatLatLng(geo.centre)}</Fact>
                <Fact label="Landmasses">{String(geo.landmasses)}</Fact>
              </dl>
              <p className="muted">Area comes from the original CShapes geometry; the centre from the largest landmass.</p>
            </section>
          )}
        </>
      )}

      {allNotes.length > 0 && (
        <section className="panel__section">
          <h3 className="panel__h3">How CShapes codes this</h3>
          <ul className="notes">
            {allNotes.map((n) => {
              const applies = activeNotes.some((a) => a.id === n.id);
              return (
                <li key={n.id} className={applies ? 'note note--active' : 'note'}>
                  <p>
                    <DataBadge kind={n.provenance === 'verified' ? 'verified' : 'dataset'} />{' '}
                    <span className="note__when">
                      {applies ? 'Applies on this date · ' : ''}
                      {formatDate(n.from)} – {formatDate(n.to)}
                    </span>
                  </p>
                  <p>{n.text}</p>
                  <SourceLinks sources={n.sources} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="panel__section">
        <h3 className="panel__h3">
          Boundary history <DataBadge kind="dataset" />
        </h3>
        <ol className="periods">
          {periods.map((p) => {
            const current = props?.fid === p.fid;
            return (
              <li key={p.fid} className={current ? 'is-current' : undefined}>
                <button
                  type="button"
                  className="periods__btn"
                  onClick={() => onJumpToYear(Math.max(yearOf(p.start), service.meta.firstYear), gw)}
                  title={`Show ${yearOf(p.start)}`}
                >
                  <span className="periods__dates">
                    {yearOf(p.start)}–{yearOf(p.end)}
                  </span>
                  <span className="periods__what">{STATUS_LABEL[p.status]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="muted">Each row is one polygon; a new row means CShapes coded a change in border or status.</p>
      </section>

      <div className="panel__actions">
        {feature && (
          <button type="button" className="btn" onClick={onFocus}>
            Centre on globe
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Clear selection
        </button>
      </div>
    </div>
  );
}
