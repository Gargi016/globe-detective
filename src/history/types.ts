import type { Feature } from 'geojson';
import type { CountryGeometry } from '../types/geo';

/** Which day of the selected year the snapshot depicts. */
export type Anchor = 'start' | 'mid' | 'end';

/** Political status of a polygon in CShapes. `unclassified` is CShapes' own "N/A". */
export type EntityStatus =
  | 'independent'
  | 'colony'
  | 'protectorate'
  | 'mandate'
  | 'occupied'
  | 'unclassified';

export const STATUS_ORDER: EntityStatus[] = [
  'independent',
  'colony',
  'protectorate',
  'mandate',
  'occupied',
  'unclassified',
];

export const STATUS_LABEL: Record<EntityStatus, string> = {
  independent: 'Independent state',
  colony: 'Colony',
  protectorate: 'Protectorate',
  mandate: 'Mandate',
  occupied: 'Occupied',
  unclassified: 'Status not coded',
};

/** Attributes carried by every polygon in the processed CShapes file (see scripts/build-history-data.mjs). */
export interface RawPeriodProps {
  /** CShapes feature id: one polygon valid for one date range. */
  id: number;
  /** Gleditsch–Ward country code: the identifier that persists across a state's polygons. */
  gw: number;
  /** CShapes' own country label, e.g. "Myanmar (Burma)". Not period-specific. */
  label: string;
  /** First and last day (inclusive) the polygon is valid, ISO yyyy-mm-dd. */
  start: string;
  end: string;
  status: string;
  /** GW code of the controlling state for dependent units; equals `gw` for independent states. */
  owner: number | null;
  cap: string;
  capLat: number;
  capLng: number;
  /** 1 if the boundary is treaty-/formally defined in this period, 0 if CShapes marks it undefined. */
  bdef: 0 | 1;
  /** Area in km², computed from the original unsimplified geometry. */
  area: number;
}

/** One polygon of one entity, valid for one date range. */
export interface Period {
  fid: number;
  gw: number;
  datasetLabel: string;
  start: string;
  end: string;
  status: EntityStatus;
  owner: number | null;
  capital: { name: string; lat: number; lng: number };
  boundaryDefined: boolean;
  areaKm2: number;
}

/** ISO calendar date, yyyy-mm-dd. Plain string so dates compare lexicographically. */
export type IsoDate = string;

/** An external source a curated statement relies on. */
export interface SourceRef {
  label: string;
  url: string;
}

/**
 * How trustworthy a name or note is:
 *  - verified:    checked against the cited sources
 *  - descriptive: this project's own wording for a situation with no official name
 *  - dataset:     CShapes' own label or coding, which can be a modern name or a simplification
 */
export type Provenance = 'verified' | 'descriptive' | 'dataset';

export interface NameInfo {
  name: string;
  official: string | null;
  provenance: Provenance;
  /** True when the start of this name's period is only known to the year or month. */
  approximate: boolean;
  note: string | null;
  sources: SourceRef[];
}

/** A place where CShapes' coding differs from, or simplifies, the real history. */
export interface DatasetNote {
  id: string;
  /** GW code the note applies to; 0 = the whole dataset. */
  gw: number;
  from: IsoDate;
  to: IsoDate;
  text: string;
  provenance: 'verified' | 'dataset';
  sources: SourceRef[];
}

export interface HistoricalProps {
  /** Stable identity across years: all polygons of one entity share it. */
  key: string;
  fid: number;
  gw: number;
  /** Period-appropriate display name (see nameInfo.provenance for how far to trust it). */
  name: string;
  nameInfo: NameInfo;
  datasetLabel: string;
  status: EntityStatus;
  owner: number | null;
  ownerName: string | null;
  start: string;
  end: string;
  boundaryDefined: boolean;
  capital: { name: string; lat: number; lng: number };
  areaKm2: number;
}

export type HistoricalFeature = Feature<CountryGeometry, HistoricalProps>;

export interface CoverageGap {
  reason: 'before' | 'after' | 'invalid';
  title: string;
  message: string;
}

interface SnapshotBase {
  year: number;
  anchor: Anchor;
  /** The exact date depicted, ISO yyyy-mm-dd. */
  date: string;
}

export type Snapshot =
  | (SnapshotBase & {
      covered: true;
      features: HistoricalFeature[];
      counts: Record<EntityStatus, number>;
      undefinedBoundaryCount: number;
    })
  | (SnapshotBase & { covered: false; features: []; gap: CoverageGap });

export type ChangeKind = 'appears' | 'reappears' | 'ends' | 'status' | 'boundary' | 'defined';

/** A change derived directly from CShapes polygon periods. */
export interface BoundaryChange {
  id: string;
  date: string;
  gw: number;
  kind: ChangeKind;
  magnitude: 'major' | 'minor';
  title: string;
  detail: string;
  /** Percentage change in area, for `boundary` changes. */
  areaDeltaPct?: number;
}

/** A renaming derived from the sourced name table (not from CShapes). */
export interface NameChange {
  date: IsoDate;
  gw: number;
  from: string;
  to: string;
  official: string | null;
  approximate: boolean;
  note: string | null;
  sources: SourceRef[];
}

export interface EntitySummary {
  gw: number;
  /** Every distinct name the entity has in the name table and in CShapes. */
  names: string[];
  firstStart: string;
  lastEnd: string;
  periodCount: number;
}

export interface DatasetMeta {
  name: string;
  coverageStart: string;
  coverageEnd: string;
  firstYear: number;
  lastYear: number;
  citation: string;
  doi: string;
  homepage: string;
  license: string;
  licenseUrl: string;
  systemNote: string;
}
