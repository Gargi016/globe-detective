import { geoArea, geoBounds, geoCentroid } from 'd3-geo';
import type { Feature } from 'geojson';
import type { CountryGeometry } from '../types/geo';

/** Any polygon feature: modern atlas countries and historical CShapes polygons both qualify. */
export type PolygonFeature = Feature<CountryGeometry, unknown>;

/** Mean Earth radius in km (IUGG), used to convert spherical area (steradians) to km². */
const EARTH_RADIUS_KM = 6371.0088;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CountryAnalysis {
  /** Centre of the largest landmass (area-weighted centroid on the sphere). */
  centre: LatLng;
  /** Total area of all landmasses in the 110m dataset, in km². Approximate. */
  areaKm2: number;
  landmasses: number;
  /** Bounding box of the largest landmass, in degrees. */
  bounds: { west: number; south: number; east: number; north: number };
  latSpan: number;
  lngSpan: number;
  latitudeZone: string;
  longitudeZone: string;
  /** Camera altitude (globe radii) that frames the largest landmass. */
  focusAltitude: number;
}

const cache = new WeakMap<PolygonFeature, CountryAnalysis>();

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function polygonsOf(f: PolygonFeature) {
  const g = f.geometry;
  if (g.type === 'Polygon') return [g];
  return g.coordinates.map((coordinates) => ({ type: 'Polygon' as const, coordinates }));
}

/** Derives basic geography from the country's polygons. Results are cached per feature. */
export function analyzeCountry(f: PolygonFeature): CountryAnalysis {
  const hit = cache.get(f);
  if (hit) return hit;

  const polys = polygonsOf(f);
  let total = 0;
  let largest = polys[0];
  let largestArea = -1;
  for (const p of polys) {
    const a = geoArea(p);
    total += a;
    if (a > largestArea) {
      largestArea = a;
      largest = p;
    }
  }

  const [[west, south], [east, north]] = geoBounds(largest);
  const wraps = west > east;
  const lngSpan = wraps ? east + 360 - west : east - west;
  const latSpan = north - south;

  let [lng, lat] = geoCentroid(largest);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = (north + south) / 2;
    lng = wraps ? ((west + east + 360) / 2 + 180) % 360 - 180 : (west + east) / 2;
  }

  const latitudeZone =
    south >= 0 ? 'Northern Hemisphere' : north <= 0 ? 'Southern Hemisphere' : 'Spans the Equator';
  const longitudeZone = wraps
    ? 'Spans the 180° meridian'
    : west < 0 && east > 0
      ? 'Spans the Prime Meridian'
      : east <= 0
        ? 'Western Hemisphere'
        : 'Eastern Hemisphere';

  const span = Math.max(latSpan, lngSpan);
  const result: CountryAnalysis = {
    centre: { lat, lng },
    areaKm2: total * EARTH_RADIUS_KM * EARTH_RADIUS_KM,
    landmasses: polys.length,
    bounds: { west, south, east, north },
    latSpan,
    lngSpan,
    latitudeZone,
    longitudeZone,
    focusAltitude: clamp(0.3 + span / 28, 0.5, 2.0),
  };
  cache.set(f, result);
  return result;
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLng(lng: number): string {
  return `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
}

export function formatLatLng(p: LatLng): string {
  return `${formatLat(p.lat)}, ${formatLng(p.lng)}`;
}

export function formatArea(km2: number): string {
  const rounded = km2 >= 1000 ? Math.round(km2 / 1000) * 1000 : Math.round(km2 / 100) * 100;
  return `≈ ${new Intl.NumberFormat('en-US').format(rounded)} km²`;
}
