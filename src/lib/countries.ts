import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { CountryCollection, CountryFeature, CountryProperties } from '../types/geo';

export type MapPerspective = 'india-official' | 'de-facto';

export const ATLAS_SOI_URL = `${import.meta.env.BASE_URL}data/countries-110m-soi.json`;
export const ATLAS_DE_FACTO_URL = `${import.meta.env.BASE_URL}data/countries-110m.json`;
/** Default modern atlas URL: India's Official Territorial Perspective (Survey of India standard) */
export const ATLAS_URL = ATLAS_SOI_URL;

let cacheDeFacto: Promise<CountryFeature[]> | null = null;
let cacheSoi: Promise<CountryFeature[]> | null = null;

/**
 * Loads modern country polygons from world-atlas.
 * Defaults to India's Official Territorial Perspective (Survey of India standard).
 * The result is cached for the lifetime of the page so remounting the globe does not refetch.
 * A failed request is not cached, so retrying really retries.
 */
export function loadCountries(
  perspective: MapPerspective | 'india-claimed' = 'india-official',
): Promise<CountryFeature[]> {
  if (perspective === 'de-facto') {
    if (!cacheDeFacto) {
      cacheDeFacto = fetchCountries(ATLAS_DE_FACTO_URL).catch((err: unknown) => {
        cacheDeFacto = null;
        throw err;
      });
    }
    return cacheDeFacto;
  }

  // Default: 'india-official' (and legacy alias 'india-claimed')
  if (!cacheSoi) {
    cacheSoi = fetchCountries(ATLAS_SOI_URL).catch((err: unknown) => {
      cacheSoi = null;
      throw err;
    });
  }
  return cacheSoi;
}

/** Reset in-memory caches for testing purposes. */
export function clearCountriesCacheForTests(): void {
  cacheDeFacto = null;
  cacheSoi = null;
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
