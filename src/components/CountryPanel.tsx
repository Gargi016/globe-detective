import type { CountryFeature } from '../types/geo';
import { analyzeCountry, formatArea, formatLat, formatLatLng, formatLng } from '../lib/geo';
import { displayName } from '../lib/names';
import DataBadge from './DataBadge';

export interface CountryPanelProps {
  country: CountryFeature | null;
  onClose: () => void;
  onFocus: () => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function CountryPanel({ country, onClose, onFocus }: CountryPanelProps) {
  const open = country !== null;

  return (
    <aside
      className={`panel${open ? ' panel--open' : ''}`}
      aria-label="Country information"
      aria-live="polite"
    >
      {country ? <Details country={country} onClose={onClose} onFocus={onFocus} /> : <EmptyState />}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="panel__empty">
      <div className="panel__empty-mark" aria-hidden="true">
        ✦
      </div>
      <h2 className="panel__empty-title">Choose a region</h2>
      <p>
        Click any country on the globe, or search by name, to open its field notes: location, extent
        and more.
      </p>
    </div>
  );
}

function Details({
  country,
  onClose,
  onFocus,
}: {
  country: CountryFeature;
  onClose: () => void;
  onFocus: () => void;
}) {
  const a = analyzeCountry(country);
  const name = displayName(country);
  const code = country.id !== undefined && country.id !== '' ? String(country.id) : null;
  const rawName = country.properties?.name;

  return (
    <div className="panel__body" key={`${code ?? rawName}`}>
      <div className="panel__head">
        <div>
          <p className="eyebrow">Field notes</p>
          <h2 className="panel__title">{name}</h2>
          {rawName && rawName !== name && <p className="panel__sub">Map label: “{rawName}”</p>}
        </div>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close country panel">
          ×
        </button>
      </div>

      <section className="panel__section">
        <h3 className="panel__h3">
          Location <DataBadge kind="computed" />
        </h3>
        <dl className="facts">
          <Fact label="Centre" value={formatLatLng(a.centre)} />
          <Fact label="Latitude" value={formatLat(a.centre.lat)} />
          <Fact label="Longitude" value={formatLng(a.centre.lng)} />
          <Fact label="Zone" value={a.latitudeZone} />
          <Fact label="Meridian" value={a.longitudeZone} />
        </dl>
      </section>

      <section className="panel__section">
        <h3 className="panel__h3">
          Extent <DataBadge kind="computed" />
        </h3>
        <dl className="facts">
          <Fact label="Area" value={formatArea(a.areaKm2)} />
          <Fact label="Landmasses" value={String(a.landmasses)} />
          <Fact label="North–south" value={`${a.latSpan.toFixed(1)}° of latitude`} />
          <Fact label="East–west" value={`${a.lngSpan.toFixed(1)}° of longitude`} />
        </dl>
      </section>

      <section className="panel__section">
        <h3 className="panel__h3">Identifiers</h3>
        <dl className="facts">
          <Fact label="ISO numeric code" value={code ?? 'None (disputed or unrecognised)'} />
        </dl>
      </section>

      <p className="panel__note">
        Computed from modern Natural Earth 1:110m boundaries. The centre refers to the largest
        landmass; area and extent are approximate. Historical names and borders arrive in later
        phases.
      </p>

      <div className="panel__actions">
        <button type="button" className="btn" onClick={onFocus}>
          Centre on globe
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Clear selection
        </button>
      </div>
    </div>
  );
}
