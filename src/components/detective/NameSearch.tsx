import { useMemo, useState } from 'react';
import EventDetails from './EventDetails';
import { CERTAINTIES } from '../../detective/investigation';
import { eventsByCategory, searchEvents } from '../../detective/historicalEvents';
import { describeRanges } from '../../detective/dateRange';
import { CATEGORY_LABEL, EVENT_CATEGORIES } from '../../detective/types';
import type { Certainty } from '../../detective/clues';
import type { EventCategory, HistoricalEvent, Observation } from '../../detective/types';

export interface NameSearchProps {
  /** `${observation}:${eventId}` for everything already in the investigation. */
  added: ReadonlySet<string>;
  /** Events suggested by the state selected on the globe. */
  related: readonly HistoricalEvent[];
  relatedTitle: string | null;
  onAdd: (eventId: string, observation: Observation, certainty: Certainty) => void;
  onShowOnGlobe: (event: HistoricalEvent) => void;
  onSearched: () => void;
}

const PAGE = 8;
const CERTAINTY_LABEL: Record<Certainty, string> = {
  certain: 'I am sure I read it correctly',
  probable: 'Probably read correctly',
  uncertain: 'Hard to read, not sure',
};

/** Search by any old or new name, or browse by kind of clue, and add what the globe shows or lacks. */
export default function NameSearch({ added, related, relatedTitle, onAdd, onShowOnGlobe, onSearched }: NameSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [certainty, setCertainty] = useState<Certainty>('certain');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim();
  const results = useMemo(() => {
    const base = q ? searchEvents(q, 60) : category === 'all' ? [] : [...eventsByCategory(category)];
    return category !== 'all' && q ? base.filter((e) => e.category === category) : base;
  }, [q, category]);

  const card = (e: HistoricalEvent) => {
    const hasShows = added.has(`shows:${e.id}`);
    const hasAbsent = added.has(`absent:${e.id}`);
    return (
      <li key={e.id} className="result">
        <div className="result__head">
          <span className={`cat cat--${e.category}`}>{CATEGORY_LABEL[e.category]}</span>
          <strong className="result__title">{e.title}</strong>
          <span className="result__when">{describeRanges(e.valid, 'earlier times')}</span>
        </div>
        <div className="result__actions">
          <button type="button" className="btn btn--small" disabled={hasShows} onClick={() => onAdd(e.id, 'shows', certainty)}>
            {hasShows ? '✓ Globe shows this' : 'My globe shows this'}
          </button>
          <button type="button" className="btn btn--small btn--ghost" disabled={hasAbsent} onClick={() => onAdd(e.id, 'absent', certainty)}>
            {hasAbsent ? '✓ Globe lacks this' : 'My globe lacks this'}
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            {open === e.id ? 'Hide details' : 'What happened?'}
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => onShowOnGlobe(e)} title="Move the reference globe to this period">
            Show on globe
          </button>
        </div>
        {open === e.id && <EventDetails event={e} />}
      </li>
    );
  };

  return (
    <div className="namesearch">
      {related.length > 0 && relatedTitle && (
        <section className="namesearch__related" aria-label="Clues from the selected state">
          <h2 className="desk__h3">{relatedTitle}</h2>
          <ul className="results">{related.map(card)}</ul>
        </section>
      )}

      <label className="sr-only" htmlFor="clue-search">
        Search for a country, old name or capital
      </label>
      <input
        id="clue-search"
        className="finder__input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search an old name: Ceylon, Siam, East Germany, Léopoldville…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
          onSearched();
        }}
      />

      <div className="namesearch__controls">
        <div className="chips" role="group" aria-label="Kind of clue">
          <button type="button" className={`chip${category === 'all' ? ' is-active' : ''}`} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setShown(PAGE); }}>
            All
          </button>
          {EVENT_CATEGORIES.map((c) => (
            <button key={c} type="button" className={`chip${category === c ? ' is-active' : ''}`} aria-pressed={category === c} onClick={() => { setCategory(c); setShown(PAGE); }}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field__label">How sure are you of what you see?</span>
          <select className="select" value={certainty} onChange={(e) => setCertainty(e.target.value as Certainty)}>
            {CERTAINTIES.map((c) => (
              <option key={c} value={c}>
                {CERTAINTY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q === '' && category === 'all' && <p className="muted">Type a name from your globe, or pick a kind of clue to browse the historical events.</p>}
      {(q !== '' || category !== 'all') && results.length === 0 && (
        <p className="muted">No event matches “{q}”{category !== 'all' ? ` in ${CATEGORY_LABEL[category]}` : ''}. Try another spelling or an older or newer name.</p>
      )}
      <ul className="results">{results.slice(0, shown).map(card)}</ul>
      {results.length > shown && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({results.length - shown} left)
        </button>
      )}
    </div>
  );
}
