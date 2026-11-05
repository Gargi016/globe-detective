import { feature } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { CountryGeometry } from '../types/geo';
import { DATASET_NOTES } from './datasetNotes';
import { allNamesFor, NAME_PERIODS, namePeriodsFor, resolveName as resolveNameInfo } from './nameHistory';
import {
  STATUS_LABEL,
  STATUS_ORDER,
} from './types';
import type {
  Anchor,
  BoundaryChange,
  CoverageGap,
  DatasetMeta,
  EntityStatus,
  EntitySummary,
  DatasetNote,
  HistoricalFeature,
  NameChange,
  NameInfo,
  Period,
  RawPeriodProps,
  Snapshot,
} from './types';

export const DATASET_META: DatasetMeta = {
  name: 'CShapes 2.0',
  coverageStart: '1886-01-01',
  coverageEnd: '2019-12-31',
  firstYear: 1886,
  lastYear: 2019,
  citation:
    'Schvitz, G., Girardin, L., Rüegger, S., Weidmann, N. B., Cederman, L.-E., & Gleditsch, K. S. (2022). Mapping the International System, 1886–2019: The CShapes 2.0 Dataset. Journal of Conflict Resolution, 66(1), 144–161.',
  doi: 'https://doi.org/10.1177/00220027211013563',
  homepage: 'https://icr.ethz.ch/data/cshapes/',
  // Sources disagree: the ETH Research Collection record says CC BY-NC 4.0 (checked while building
  // this phase); an earlier review of the CShapes project page recorded CC BY-NC-SA 4.0 (not
  // re-checked). The stricter terms are applied: attribution, non-commercial, share-alike.
  license: 'CC BY-NC-SA 4.0 (strictest of the stated terms)',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  systemNote: 'State-system membership follows Gleditsch & Ward (GW).',
};

type CShapesTopology = Topology<Record<string, GeometryCollection<RawPeriodProps>>>;

export interface HistoryService {
  readonly meta: DatasetMeta;
  /** Number of polygon periods loaded. */
  readonly periodCount: number;
  /** Whether the dataset can say anything about this year. */
  coverageGap(year: number): CoverageGap | null;
  /** The exact date a year/anchor pair resolves to. */
  dateFor(year: number, anchor: Anchor): string;
  /** The world on one date of the given year. Never fabricates: uncovered years return no polygons. */
  snapshot(year: number, anchor?: Anchor): Snapshot;
  periodsOf(gw: number): readonly Period[];
  /** Whether a polygon for this entity exists on the given date. */
  existsOn(gw: number, date: string): boolean;
  summary(gw: number): EntitySummary | null;
  /** Name for an entity on a date: from the sourced name table if present, else CShapes' own label. */
  resolveName(gw: number, date: string): NameInfo;
  /** Changes between polygon periods that happen during the year, derived from CShapes. */
  changesInYear(year: number): BoundaryChange[];
  /** Renamings in the year, from the sourced name table. */
  nameChangesInYear(year: number): NameChange[];
  /** CShapes coding caveats that apply to an entity on a date (gw 0 = dataset-wide). */
  notesFor(gw: number, date: string): DatasetNote[];
  /** Every caveat for an entity, whatever the date. */
  allNotesFor(gw: number): DatasetNote[];
  /** Search every name an entity has had. */
  search(query: string, limit?: number): EntitySummary[];
  /** Years with a renaming or a major change, for timeline markers. */
  markerYears(): number[];
  /**
   * Dates (sorted, ISO) on which the depicted world visibly changes: a state appears or disappears, changes
   * status or owner, is renamed, or its area changes by 1% or more. Minor boundary revisions are not counted.
   */
  visibleChangeDates(): readonly string[];
  /**
   * The stretch of days around `date` during which none of those visible changes happens: the map looks the
   * same throughout. Clamped to the dataset's coverage.
   */
  configurationSpan(date: string): { start: string; end: string };
}

const pad = (n: number) => String(n).padStart(4, '0');
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

function normalizeStatus(raw: string): EntityStatus {
  switch (raw) {
    case 'independent':
    case 'colony':
    case 'protectorate':
    case 'mandate':
    case 'occupied':
      return raw;
    default:
      return 'unclassified';
  }
}

/** The day after an ISO date. */
function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The day before an ISO date, used to test whether two periods are contiguous. */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function createHistoryService(topology: CShapesTopology): HistoryService {
  const object = Object.values(topology.objects)[0];
  if (!object || object.type !== 'GeometryCollection') {
    throw new Error('Unexpected CShapes file: expected a GeometryCollection');
  }

  // ----- Index periods --------------------------------------------------------------------
  const geometryByFid = new Map<number, GeometryObject<RawPeriodProps>>();
  const periods: Period[] = [];
  for (const g of object.geometries) {
    const p = g.properties as RawPeriodProps | undefined;
    if (!p || p.id === undefined) continue;
    geometryByFid.set(p.id, g);
    periods.push({
      fid: p.id,
      gw: p.gw,
      datasetLabel: p.label,
      start: p.start,
      end: p.end,
      status: normalizeStatus(p.status),
      owner: p.owner,
      capital: { name: p.cap, lat: p.capLat, lng: p.capLng },
      boundaryDefined: p.bdef === 1,
      areaKm2: p.area,
    });
  }
  periods.sort((a, b) => a.gw - b.gw || a.start.localeCompare(b.start));

  const byGw = new Map<number, Period[]>();
  for (const p of periods) {
    const list = byGw.get(p.gw);
    if (list) list.push(p);
    else byGw.set(p.gw, [p]);
  }

  // Geometry is decoded lazily, once per polygon.
  const geometryCache = new Map<number, CountryGeometry>();
  function geometryOf(fid: number): CountryGeometry {
    const hit = geometryCache.get(fid);
    if (hit) return hit;
    const g = geometryByFid.get(fid);
    if (!g) throw new Error(`No geometry for CShapes feature ${fid}`);
    const f = feature(topology, g) as unknown as { geometry: CountryGeometry };
    geometryCache.set(fid, f.geometry);
    return f.geometry;
  }

  // ----- Names ----------------------------------------------------------------------------
  function labelOf(gw: number): string {
    return byGw.get(gw)?.[0]?.datasetLabel ?? `Entity ${gw}`;
  }

  function resolveNameFor(gw: number, date: string, label: string): NameInfo {
    return resolveNameInfo(gw, date, label);
  }

  function resolveName(gw: number, date: string): NameInfo {
    // Prefer the label of the polygon actually valid on that date, else the entity's first label.
    const list = byGw.get(gw);
    const live = list?.find((p) => p.start <= date && date <= p.end);
    return resolveNameFor(gw, date, live?.datasetLabel ?? labelOf(gw));
  }

  // ----- Coverage -------------------------------------------------------------------------
  function coverageGap(year: number): CoverageGap | null {
    if (!Number.isInteger(year)) {
      return {
        reason: 'invalid',
        title: 'Not a year',
        message: 'Enter a whole number of years, for example 1965.',
      };
    }
    if (year < DATASET_META.firstYear) {
      return {
        reason: 'before',
        title: `No coverage before ${DATASET_META.firstYear}`,
        message: `${DATASET_META.name} starts on 1 January ${DATASET_META.firstYear}, so it has no boundaries for ${year}. Nothing is drawn rather than guessing: this app does not extrapolate or invent borders.`,
      };
    }
    if (year > DATASET_META.lastYear) {
      return {
        reason: 'after',
        title: `No coverage after ${DATASET_META.lastYear}`,
        message: `${DATASET_META.name} ends on 31 December ${DATASET_META.lastYear}, so it has no boundaries for ${year}. Nothing is drawn rather than guessing. The Home page shows modern borders from a different dataset (Natural Earth), which is not part of this timeline.`,
      };
    }
    return null;
  }

  function dateFor(year: number, anchor: Anchor): string {
    const y = pad(year);
    return anchor === 'start' ? `${y}-01-01` : anchor === 'mid' ? `${y}-07-01` : `${y}-12-31`;
  }

  // ----- Snapshots ------------------------------------------------------------------------
  const snapshotCache = new Map<string, Snapshot>();
  // Feature objects are reused between snapshots when nothing about them changed. The globe
  // renderer keys its meshes on object identity, so a stable object means no geometry rebuild
  // when the year moves and a state simply carries on unchanged.
  const featureCache = new Map<string, HistoricalFeature>();

  function snapshot(year: number, anchor: Anchor = 'start'): Snapshot {
    const cacheKey = `${year}:${anchor}`;
    const cached = snapshotCache.get(cacheKey);
    if (cached) return cached;

    const date = Number.isInteger(year) && year >= 0 && year <= 9999 ? dateFor(year, anchor) : '';
    const gap = coverageGap(year);
    let result: Snapshot;

    if (gap) {
      result = { year, anchor, date, covered: false, features: [], gap };
    } else {
      const features: HistoricalFeature[] = [];
      const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<EntityStatus, number>;
      let undefinedBoundaryCount = 0;
      for (const p of periods) {
        if (p.start > date || p.end < date) continue;
        const name = resolveNameFor(p.gw, date, p.datasetLabel);
        let ownerName: string | null = null;
        if (p.owner !== null && p.owner !== p.gw) {
          ownerName = resolveName(p.owner, date).name;
        }
        counts[p.status] += 1;
        if (!p.boundaryDefined) undefinedBoundaryCount += 1;
        const featureKey = `${p.fid}|${JSON.stringify(name)}|${ownerName ?? ''}`;
        const reused = featureCache.get(featureKey);
        if (reused) {
          features.push(reused);
          continue;
        }
        const built: HistoricalFeature = {
          type: 'Feature',
          id: `gw:${p.gw}`,
          geometry: geometryOf(p.fid),
          properties: {
            key: `gw:${p.gw}`,
            fid: p.fid,
            gw: p.gw,
            name: name.name,
            nameInfo: name,
            datasetLabel: p.datasetLabel,
            status: p.status,
            owner: p.owner,
            ownerName,
            start: p.start,
            end: p.end,
            boundaryDefined: p.boundaryDefined,
            capital: p.capital,
            areaKm2: p.areaKm2,
          },
        };
        featureCache.set(featureKey, built);
        features.push(built);
      }
      result = { year, anchor, date, covered: true, features, counts, undefinedBoundaryCount };
    }
    snapshotCache.set(cacheKey, result);
    return result;
  }

  // ----- Changes derived from the data ----------------------------------------------------
  function changesInYear(year: number): BoundaryChange[] {
    if (coverageGap(year)) return [];
    const from = `${pad(year)}-01-01`;
    const to = `${pad(year)}-12-31`;
    const out: BoundaryChange[] = [];

    for (const [gw, list] of byGw) {
      list.forEach((p, i) => {
        const prev = i > 0 ? list[i - 1] : undefined;
        const contiguous = prev !== undefined && prev.end === dayBefore(p.start);

        // A polygon period beginning during the year.
        if (p.start >= from && p.start <= to && p.start > DATASET_META.coverageStart) {
          const name = resolveNameFor(gw, p.start, p.datasetLabel).name;
          if (!prev || !contiguous) {
            out.push({
              id: `${p.fid}-appear`,
              date: p.start,
              gw,
              kind: prev ? 'reappears' : 'appears',
              magnitude: 'major',
              title: `${name} ${prev ? 'reappears' : 'appears'}`,
              detail: `First coded as ${STATUS_LABEL[p.status].toLowerCase()}${
                p.owner !== null && p.owner !== gw ? ` under ${resolveName(p.owner, p.start).name}` : ''
              }.${prev ? ` Previous polygon ended ${formatDate(prev.end)}.` : ''}`,
            });
          } else if (prev.status !== p.status) {
            const before = resolveNameFor(gw, prev.end, prev.datasetLabel).name;
            out.push({
              id: `${p.fid}-status`,
              date: p.start,
              gw,
              kind: 'status',
              magnitude: 'major',
              title: before === name ? name : `${before} → ${name}`,
              detail: `Status: ${STATUS_LABEL[prev.status].toLowerCase()} → ${STATUS_LABEL[p.status].toLowerCase()}.`,
            });
          } else {
            const delta = prev.areaKm2 > 0 ? ((p.areaKm2 - prev.areaKm2) / prev.areaKm2) * 100 : 0;
            const definedNow = p.boundaryDefined && !prev.boundaryDefined;
            out.push({
              id: `${p.fid}-boundary`,
              date: p.start,
              gw,
              kind: definedNow ? 'defined' : 'boundary',
              magnitude: Math.abs(delta) >= 1 || definedNow ? 'major' : 'minor',
              title: definedNow ? `${name}: borders formally defined` : `${name}: boundary revised`,
              detail: `Area ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(Math.abs(delta) < 0.1 ? 3 : 1)}% (${Math.abs(
                Math.round(p.areaKm2 - prev.areaKm2),
              ).toLocaleString('en-US')} km² ${delta >= 0 ? 'gained' : 'lost'}).`,
              areaDeltaPct: delta,
            });
          }
        }

        // A polygon period ending during the year with nothing contiguous after it.
        const next = i < list.length - 1 ? list[i + 1] : undefined;
        const continues = next !== undefined && p.end === dayBefore(next.start);
        if (p.end >= from && p.end <= to && p.end < DATASET_META.coverageEnd && !continues) {
          const name = resolveNameFor(gw, p.end, p.datasetLabel).name;
          out.push({
            id: `${p.fid}-end`,
            date: p.end,
            gw,
            kind: 'ends',
            magnitude: 'major',
            title: `${name} ends`,
            detail: `Last coded day ${formatDate(p.end)}. Its territory may continue under other entities.`,
          });
        }
      });
    }

    const rank = (c: BoundaryChange) => (c.magnitude === 'major' ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }

  // ----- Name changes and caveats ---------------------------------------------------------
  const allNameChanges: NameChange[] = [];
  const gwWithNames = new Set<number>(DATASET_NAME_GWS());
  function DATASET_NAME_GWS(): number[] {
    return [...byGw.keys()].filter((gw) => namePeriodsFor(gw).length > 0);
  }
  for (const gw of gwWithNames) {
    const periods = namePeriodsFor(gw);
    for (let i = 1; i < periods.length; i++) {
      const prev = periods[i - 1];
      const cur = periods[i];
      if (cur.name === prev.name || cur.from === '') continue;
      allNameChanges.push({
        date: cur.from,
        gw,
        from: prev.name,
        to: cur.name,
        official: cur.official ?? null,
        approximate: cur.precision !== 'day',
        note: cur.note ?? null,
        sources: cur.sources,
      });
    }
  }
  allNameChanges.sort((a, b) => a.date.localeCompare(b.date));

  function nameChangesInYear(year: number): NameChange[] {
    const prefix = `${pad(year)}-`;
    return allNameChanges.filter((c) => c.date.startsWith(prefix));
  }

  const allNotesFor = (gw: number): DatasetNote[] => DATASET_NOTES.filter((n) => n.gw === gw);
  const notesFor = (gw: number, date: string): DatasetNote[] =>
    DATASET_NOTES.filter((n) => n.gw === gw && n.from <= date && date <= n.to);

  const markers = new Set<number>(allNameChanges.map((c) => Number(c.date.slice(0, 4))));
  for (let y = DATASET_META.firstYear; y <= DATASET_META.lastYear; y++) {
    if (changesInYear(y).some((c) => c.magnitude === 'major' && c.kind !== 'boundary')) markers.add(y);
  }

  // ----- Entities and search --------------------------------------------------------------
  function summary(gw: number): EntitySummary | null {
    const list = byGw.get(gw);
    if (!list || list.length === 0) return null;
    const names: string[] = [];
    const push = (n: string) => {
      if (!names.includes(n)) names.push(n);
    };
    for (const n of allNamesFor(gw)) push(n);
    for (const p of list) push(p.datasetLabel);
    return {
      gw,
      names,
      firstStart: list[0].start,
      lastEnd: list[list.length - 1].end,
      periodCount: list.length,
    };
  }

  const searchIndex = [...byGw.keys()]
    .map((gw) => {
      const s = summary(gw);
      if (!s) return null;
      // allNamesFor() already includes formal names such as "Union of Soviet Socialist Republics".
      return { s, hay: s.names.map(normalize) };
    })
    .filter((x): x is { s: EntitySummary; hay: string[] } => x !== null);

  function search(query: string, limit = 8): EntitySummary[] {
    const q = normalize(query);
    if (!q) return [];
    return searchIndex
      .map(({ s, hay }) => {
        let rank = -1;
        hay.forEach((h, i) => {
          const r = h === q ? 0 : h.startsWith(q) ? 1 : h.split(/[\s\-'(),/]+/).some((w) => w.startsWith(q)) ? 2 : h.includes(q) ? 3 : -1;
          if (r !== -1 && (rank === -1 || r + (i > 0 ? 0.5 : 0) < rank)) rank = r + (i > 0 ? 0.5 : 0);
        });
        return { s, rank };
      })
      .filter((x) => x.rank !== -1)
      .sort((a, b) => a.rank - b.rank || a.s.names[0].localeCompare(b.s.names[0]))
      .slice(0, limit)
      .map((x) => x.s);
  }

  // ----- Visible change dates (used to say how long a map stays the same) ------------------
  let changeDates: string[] | null = null;
  function visibleChangeDates(): readonly string[] {
    if (changeDates) return changeDates;
    const set = new Set<string>();
    for (const list of byGw.values()) {
      list.forEach((p, i) => {
        const prev = i > 0 ? list[i - 1] : undefined;
        const next = i < list.length - 1 ? list[i + 1] : undefined;
        if (!prev || prev.end !== dayBefore(p.start)) set.add(p.start);
        else if (prev.status !== p.status || prev.owner !== p.owner || prev.boundaryDefined !== p.boundaryDefined) set.add(p.start);
        else {
          const delta = prev.areaKm2 > 0 ? Math.abs((p.areaKm2 - prev.areaKm2) / prev.areaKm2) * 100 : 0;
          if (delta >= 1) set.add(p.start);
        }
        if (!next || p.end !== dayBefore(next.start)) set.add(dayAfter(p.end));
      });
    }
    for (const n of NAME_PERIODS) {
      if (n.from !== '') set.add(n.from);
      if (n.to !== null) set.add(dayAfter(n.to));
    }
    changeDates = [...set]
      .filter((d) => d > DATASET_META.coverageStart && d <= DATASET_META.coverageEnd)
      .sort();
    return changeDates;
  }

  function configurationSpan(date: string): { start: string; end: string } {
    const all = visibleChangeDates();
    let start: string = DATASET_META.coverageStart;
    let end: string = DATASET_META.coverageEnd;
    for (const d of all) {
      if (d <= date) start = d;
      else {
        end = dayBefore(d);
        break;
      }
    }
    return { start, end };
  }

  return {
    meta: DATASET_META,
    periodCount: periods.length,
    visibleChangeDates,
    configurationSpan,
    coverageGap,
    dateFor,
    snapshot,
    periodsOf: (gw) => byGw.get(gw) ?? [],
    existsOn: (gw, date) => (byGw.get(gw) ?? []).some((p) => p.start <= date && date <= p.end),
    summary,
    resolveName,
    changesInYear,
    nameChangesInYear,
    notesFor,
    allNotesFor,
    search,
    markerYears: () => [...markers].sort((a, b) => a - b),
  };
}
