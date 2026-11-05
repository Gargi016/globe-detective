import { useMemo, useState } from 'react';
import type { HistoryService } from '../../history/historyService';

export interface EntityFinderProps {
  service: HistoryService;
  date: string;
  onPick: (gw: number) => void;
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));

/** Finds a state by any name it has had ("Ceylon", "Sri Lanka", "Soviet"), whether or not it exists in the shown year. */
export default function EntityFinder({ service, date, onPick }: EntityFinderProps) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => service.search(query, 10), [service, query]);

  return (
    <div className="finder">
      <label className="sr-only" htmlFor="entity-finder">
        Find a state by any of its names
      </label>
      <input
        id="entity-finder"
        className="finder__input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Find a state: try “Ceylon”, “Burma”, “Rhodesia”…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() !== '' && results.length === 0 && (
        <p className="muted">
          No state in CShapes has a name matching “{query}”. Very small states are not in the dataset.
        </p>
      )}
      <ul className="finder__list">
        {results.map((s) => {
          const here = service.existsOn(s.gw, date);
          const label = here ? service.resolveName(s.gw, date).name : s.names[0];
          return (
            <li key={s.gw}>
              <button type="button" className="finder__item" onClick={() => onPick(s.gw)}>
                <span className="finder__name">{label}</span>
                <span className="finder__meta">
                  {yearOf(s.firstStart)}–{yearOf(s.lastEnd)} ·{' '}
                  {here ? 'shown now' : 'not in this snapshot: opens the nearest year'}
                </span>
                {s.names.length > 1 && <span className="finder__aka">Also: {s.names.filter((n) => n !== label).slice(0, 4).join(' · ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
