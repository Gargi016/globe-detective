import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { CountryCollection, CountryFeature, CountryProperties } from '../types/geo';

/** Active Modern Explorer atlas URL: India's Official Territorial Perspective (Survey of India standard model) */
export const ATLAS_URL = `${import.meta.env.BASE_URL}data/countries-110m-soi.json`;
export const ATLAS_SOI_URL = ATLAS_URL;

/** Preserved archival reference URL (retained for baseline reference; not loaded by the public app) */
export const ATLAS_ARCHIVAL_DE_FACTO_URL = `${import.meta.env.BASE_URL}data/countries-110m.json`;
export const ATLAS_DE_FACTO_URL = ATLAS_ARCHIVAL_DE_FACTO_URL;

let cache: Promise<CountryFeature[]> | null = null;

/**
 * Loads modern country polygons representing India's Official Territorial Perspective.
 * The result is cached for the lifetime of the page so remounting the globe does not refetch.
 * A failed request is not cached, so retrying really retries.
 */
export function loadCountries(): Promise<CountryFeature[]> {
  if (!cache) {
    cache = fetchCountries(ATLAS_URL).catch((err: unknown) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

/** Reset in-memory cache for testing purposes. */
export function clearCountriesCacheForTests(): void {
  cache = null;
}

async function fetchCountries(url: string): Promise<CountryFeature[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Atlas request failed (${res.status}) for ${url}`);
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
