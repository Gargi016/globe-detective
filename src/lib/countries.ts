import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { CountryCollection, CountryFeature, CountryProperties } from '../types/geo';

export const ATLAS_URL = `${import.meta.env.BASE_URL}data/countries-110m.json`;

let cache: Promise<CountryFeature[]> | null = null;

/**
 * Loads country polygons from world-atlas. The result is cached for the lifetime of the
 * page so remounting the globe (e.g. after visiting another page) does not refetch.
 * A failed request is not cached, so "Try again" really retries.
 */
export function loadCountries(): Promise<CountryFeature[]> {
  if (!cache) {
    cache = fetchCountries().catch((err: unknown) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

async function fetchCountries(): Promise<CountryFeature[]> {
  const res = await fetch(ATLAS_URL);
  if (!res.ok) throw new Error(`Atlas request failed (${res.status})`);
  const topology = (await res.json()) as Topology<{
    countries: GeometryCollection<CountryProperties>;
  }>;
  const collection = feature(topology, topology.objects.countries) as unknown as CountryCollection;
  return collection.features;
}

/** Stable identity for a country. A few disputed territories have no ISO code, so fall back to the name. */
export function countryKey(f: CountryFeature): string {
  return f.id !== undefined && f.id !== null && f.id !== '' ? `id:${f.id}` : `name:${f.properties?.name}`;
}
