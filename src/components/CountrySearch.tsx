import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CountryFeature } from '../types/geo';
import { countryKey } from '../lib/countries';
import { displayName, normalize, searchTerms } from '../lib/names';

const MAX_RESULTS = 8;

interface Indexed {
  feature: CountryFeature;
  name: string;
  terms: string[];
}

export interface CountrySearchProps {
  countries: CountryFeature[];
  /** Name of the currently selected country; mirrored into the input. */
  selectedName: string | null;
  onSelect: (feature: CountryFeature) => void;
  disabled?: boolean;
}

/**
 * Rank (lower is better): 0 = exact match on a name or alias, 1 = name starts with query,
 * 2 = an alias or word starts with it, 3 = contains it, -1 = no match.
 */
function rank(item: Indexed, q: string): number {
  let best = -1;
  item.terms.forEach((term, i) => {
    let r = -1;
    if (term === q) r = 0;
    else if (term.startsWith(q)) r = i === 0 ? 1 : 2;
    else if (term.split(/[\s\-'.]+/).some((w) => w.startsWith(q))) r = 2;
    else if (term.includes(q)) r = 3;
    if (r !== -1 && (best === -1 || r < best)) best = r;
  });
  return best;
}

export default function CountrySearch({ countries, selectedName, onSelect, disabled }: CountrySearchProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Keep the input in step with selections made elsewhere (globe click, Escape, etc.).
  useEffect(() => {
    setQuery(selectedName ?? '');
  }, [selectedName]);

  const index = useMemo<Indexed[]>(
    () =>
      countries
        .map((feature) => ({
          feature,
          name: displayName(feature),
          terms: searchTerms(feature).map(normalize),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [countries],
  );

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return index.slice(0, MAX_RESULTS);
    return index
      .map((item) => ({ item, r: rank(item, q) }))
      .filter((x) => x.r !== -1)
      .sort((a, b) => a.r - b.r || a.item.name.localeCompare(b.item.name))
      .slice(0, MAX_RESULTS)
      .map((x) => x.item);
  }, [index, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: Indexed) => {
    onSelect(item.feature);
    setQuery(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  const showList = open && !disabled;
  const activeId = showList && results[active] ? `${uid}-opt-${countryKey(results[active].feature)}` : undefined;

  return (
    <div className="search">
      <label className="sr-only" htmlFor={`${uid}-input`}>
        Search for a country
      </label>
      <svg className="search__icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13 13l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        id={`${uid}-input`}
        className="search__input"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        placeholder={disabled ? 'Loading countries…' : 'Search countries — try “Burma” or “UK”'}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {query && !disabled && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery('');
            setOpen(true);
            inputRef.current?.focus();
          }}
        >
          ×
        </button>
      )}

      {showList && (
        <ul
          id={listId}
          className="search__list"
          role="listbox"
          aria-label="Matching countries"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <li className="search__empty" role="presentation">
              No country matches “{query}”.
              <span>The map data omits very small states.</span>
            </li>
          ) : (
            results.map((item, i) => (
              <li
                key={countryKey(item.feature)}
                id={`${uid}-opt-${countryKey(item.feature)}`}
                role="option"
                aria-selected={i === active}
                className={`search__option${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                {item.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
