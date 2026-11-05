import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/** Properties carried by each country in the world-atlas dataset. */
export interface CountryProperties {
  name: string;
}

export type CountryGeometry = Polygon | MultiPolygon;
export type CountryFeature = Feature<CountryGeometry, CountryProperties>;
export type CountryCollection = FeatureCollection<CountryGeometry, CountryProperties>;
