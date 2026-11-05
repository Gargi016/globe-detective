import { useState } from 'react';
import { formatDate } from '../../history/historyService';
import type { BoundaryChange, NameChange } from '../../history/types';
import DataBadge from '../DataBadge';
import SourceLinks from './SourceLinks';

export interface ChangesPanelProps {
  year: number;
  covered: boolean;
  changes: readonly BoundaryChange[];
  nameChanges: readonly NameChange[];
  onSelectGw: (gw: number) => void;
}

const KIND_LABEL: Record<BoundaryChange['kind'], string> = {
  appears: 'New',
  reappears: 'Returns',
  ends: 'Ends',
  status: 'Status',
  boundary: 'Border',
  defined: 'Defined',
};

export default function ChangesPanel({ year, covered, changes, nameChanges, onSelectGw }: ChangesPanelProps) {
  const [showMinor, setShowMinor] = useState(false);

  if (!covered) {
    return (
      <p className="muted">
        There are no changes to list for {Number.isInteger(year) ? year : 'this year'}: the dataset does not cover it.
      </p>
    );
  }

  const major = changes.filter((c) => c.magnitude === 'major');
  const minor = changes.filter((c) => c.magnitude === 'minor');
  const shownMinor = showMinor ? minor : [];

  return (
    <div className="changes">
      <h2 className="panel__h3">
        Boundary and status changes in {year} <DataBadge kind="dataset" />
      </h2>
      {major.length === 0 && shownMinor.length === 0 && (
        <p className="muted">No major boundary or status changes are coded in {year}.</p>
      )}
      <ul className="changes__list">
        {[...major, ...shownMinor].map((c) => (
          <li key={c.id} className="change">
            <button type="button" className="change__btn" onClick={() => onSelectGw(c.gw)}>
              <span className={`change__kind change__kind--${c.kind}`}>{KIND_LABEL[c.kind]}</span>
              <span className="change__main">
                <strong>{c.title}</strong>
                <span className="change__detail">{c.detail}</span>
              </span>
              <time className="change__date" dateTime={c.date}>
                {formatDate(c.date)}
              </time>
            </button>
          </li>
        ))}
      </ul>
      {minor.length > 0 && (
        <button type="button" className="linkbtn" onClick={() => setShowMinor((v) => !v)}>
          {showMinor ? 'Hide' : 'Show'} {minor.length} minor border revision{minor.length === 1 ? '' : 's'} (under 1% of area)
        </button>
      )}

      <h2 className="panel__h3 panel__h3--spaced">
        Renamings in {year} <DataBadge kind="verified" />
      </h2>
      {nameChanges.length === 0 ? (
        <p className="muted">No renamings are recorded in the name table for {year}.</p>
      ) : (
        <ul className="changes__list">
          {nameChanges.map((c) => (
            <li key={`${c.gw}-${c.date}`} className="change change--name">
              <button type="button" className="change__btn" onClick={() => onSelectGw(c.gw)}>
                <span className="change__kind change__kind--name">Name</span>
                <span className="change__main">
                  <strong>
                    {c.from} → {c.to}
                  </strong>
                  {c.official && <span className="change__detail">{c.official}</span>}
                  {c.approximate && <span className="change__detail approx">Date approximate (year or month only).</span>}
                </span>
                <time className="change__date" dateTime={c.date}>
                  {formatDate(c.date)}
                </time>
              </button>
              <SourceLinks sources={c.sources} />
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Changes are derived by comparing consecutive CShapes polygons, so dates follow CShapes’ coding, which can differ
        slightly from the formal date of an event.
      </p>
    </div>
  );
}
