import { useRef } from 'react';
import GlobeView from '../components/GlobeView';
import type { GlobeViewHandle } from '../components/GlobeView';
import CountrySearch from '../components/CountrySearch';
import CountryPanel from '../components/CountryPanel';
import PerspectiveToggle from '../components/PerspectiveToggle';
import type { CountryFeature } from '../types/geo';
import type { MapPerspective } from '../lib/countries';
import { displayName } from '../lib/names';

export interface HomePageProps {
  countries: CountryFeature[];
  selected: CountryFeature | null;
  selectedKey: string | null;
  perspective: MapPerspective;
  onPerspectiveChange: (p: MapPerspective) => void;
  onSelect: (country: CountryFeature) => void;
  onClear: () => void;
  onCountriesLoaded: (countries: CountryFeature[]) => void;
}

export default function HomePage({
  countries,
  selected,
  selectedKey,
  perspective,
  onPerspectiveChange,
  onSelect,
  onClear,
  onCountriesLoaded,
}: HomePageProps) {
  const globeRef = useRef<GlobeViewHandle>(null);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Historical Geography Investigation</p>
        <h1 className="hero__title">
          Globe <span>Detective</span>
        </h1>
        <p className="hero__intro">
          Every vintage globe is a time capsule. Borders redrawn, empires dissolved, countries
          renamed — each detail is a clue to the year it was made. Explore the Earth below, scrub
          through a century of changing borders on the Timeline, then investigate a globe in
          Detective Mode or test your eye in Challenge Mode.
        </p>
        <CountrySearch
          countries={countries}
          selectedName={selected ? displayName(selected) : null}
          onSelect={onSelect}
          disabled={countries.length === 0}
        />
        <PerspectiveToggle
          perspective={perspective}
          onChange={onPerspectiveChange}
        />
      </section>

      <section className="explorer" aria-label="Interactive globe">
        <GlobeView
          ref={globeRef}
          selectedKey={selectedKey}
          perspective={perspective}
          onSelect={onSelect}
          onCountriesLoaded={onCountriesLoaded}
        />
        <CountryPanel
          country={selected}
          onClose={onClear}
          onFocus={() => selected && globeRef.current?.focusCountry(selected)}
        />
      </section>
    </>
  );
}
