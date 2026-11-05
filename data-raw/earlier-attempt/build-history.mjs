#!/usr/bin/env node
/**
 * Builds the browser-ready historical dataset from CShapes 2.0 (Gleditsch–Ward version).
 *
 *   node scripts/build-history.mjs <path/to/cshapes_2_gw.topojson> [--weight 0.001] [--xz <archive>]
 *
 * Input  : the official CShapes 2.0 TopoJSON, from the CRAN package `cshapes`
 *          (inst/extdata/cshapes_2_gw.topojson.xz, mirrored at https://github.com/cran/cshapes).
 *          Decompress it first:  xz -dc cshapes_2_gw.topojson.xz > cshapes_2_gw.topojson
 * Output : public/data/history/cshapes-gw.topo.json   (simplified, quantised, rewound geometry)
 *          public/data/history/meta.json              (provenance, licence, states, computed events)
 *
 * What this script does, and does NOT do:
 *   - It never invents or edits a border. Geometry is only simplified (Visvalingam, topology-preserving,
 *     so shared borders stay shared) and quantised to ~0.004 degrees. Polygons smaller than the
 *     simplification tolerance are dropped and counted in meta.json -> processing.
 *   - A state is never allowed to disappear. If simplification would erase one entirely
 *     (e.g. the Maldives), its original arcs are restored.
 *   - Ring winding is normalised to the d3-geo convention so spherical area/centroid maths is right.
 *   - Every date/status/owner value is copied from CShapes unchanged. Events are *computed* by
 *     comparing consecutive CShapes rows and are labelled as such in the app.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';
import { feature, quantize } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/data/history');
const OBJECT = 'cshapes_2_gw';
const EARTH_RADIUS_KM = 6371.0088;
const QUANTIZATION = 1e5;
const COVERAGE = { start: '1886-01-01', end: '2019-12-31' };

// ---------- args ----------
const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const WEIGHT = Number(flag('weight', '0.001'));
if (!inputPath || !existsSync(inputPath) || !Number.isFinite(WEIGHT) || WEIGHT < 0) {
  console.error('Usage: node scripts/build-history.mjs <cshapes_2_gw.topojson> [--weight 0.001] [--xz <archive>]');
  process.exit(1);
}
const xzPath = flag('xz', null);

function fail(message) {
  console.error(`\nBUILD FAILED: ${message}`);
  process.exit(1);
}

// ---------- read + validate ----------
const rawText = readFileSync(inputPath, 'utf8');
const inputSha256 = createHash('sha256').update(rawText).digest('hex');
const source = JSON.parse(rawText);

if (source.type !== 'Topology' || !source.objects?.[OBJECT]) fail(`expected a Topology with object "${OBJECT}"`);
if (source.transform) fail('input unexpectedly has a transform; this script assumes absolute coordinates');
const sourceGeoms = source.objects[OBJECT].geometries;
if (sourceGeoms.length !== 710) fail(`expected 710 GW polygons (CShapes 2.0), found ${sourceGeoms.length}`);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = new Map([
  ['independent', 'independent'],
  ['colony', 'colony'],
  ['protectorate', 'protectorate'],
  ['mandate', 'mandate'],
  ['occupied', 'occupied'],
  ['N/A', 'unspecified'],
]);

const arcCount = (t) => t.arcs.reduce((n, a) => n + a.length, 0);
const verticesBefore = arcCount(source);

for (const g of sourceGeoms) {
  const p = g.properties;
  if (!Number.isInteger(p.gwcode)) fail(`bad gwcode on fid ${p.fid}`);
  if (!ISO.test(p.start) || !ISO.test(p.end) || p.start > p.end) fail(`bad dates on gw ${p.gwcode}: ${p.start}..${p.end}`);
  if (!STATUS.has(p.status)) fail(`unknown status "${p.status}" on gw ${p.gwcode}`);
  if (p.start < COVERAGE.start || p.end > COVERAGE.end) fail(`row outside stated coverage: gw ${p.gwcode} ${p.start}..${p.end}`);
}

// ---------- simplify (topology-preserving) ----------
const decode = (topology, geometry) => feature(topology, geometry).geometry;
const polygonsOf = (geometry) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
const distinct = (ring) => new Set(ring.map((c) => `${c[0]},${c[1]}`)).size;
const ringOk = (ring) => ring.length >= 4 && distinct(ring) >= 4;
const arcIndexes = (arcs) => arcs.flat(Infinity).map((i) => (i < 0 ? ~i : i));

let topo = simplify(presimplify(source), WEIGHT);
if (topo.arcs.length !== source.arcs.length) fail('simplify changed the arc count; cannot restore arcs by index');
const originalArcs = source.arcs;

// Restore states that simplification would erase entirely.
const restoredStates = new Set();
for (const g of topo.objects[OBJECT].geometries) {
  const rings = polygonsOf(decode(topo, g));
  if (!rings.some((poly) => ringOk(poly[0]))) {
    for (const i of arcIndexes(g.arcs)) topo.arcs[i] = originalArcs[i];
    restoredStates.add(`${g.properties.gwcode} ${g.properties.country_name}`);
  }
}

// Quantise (also delta-encodes arcs), then rebuild rings that survived and rewind them.
topo = quantize(topo, QUANTIZATION);

const geomsOut = topo.objects[OBJECT].geometries;
let droppedRings = 0;
let flippedRings = 0;

/** Signed area (shoelace) of a ring in lon/lat. Positive = counter-clockwise (y up). */
function planarSignedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}
const flip = (arcRing) => arcRing.slice().reverse().map((i) => ~i);

for (const g of geomsOut) {
  const decoded = decode(topo, g);
  const polyArcs = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  const polyCoords = polygonsOf(decoded);
  const keptPolys = [];

  polyArcs.forEach((ringsArcs, p) => {
    const coords = polyCoords[p];
    if (!ringOk(coords[0])) {
      droppedRings += coords.length;
      return; // exterior collapsed: drop the whole polygon (holes go with it)
    }
    const rings = [];
    coords.forEach((ring, r) => {
      if (!ringOk(ring)) {
        droppedRings += 1;
        return;
      }
      // d3-geo convention: exterior clockwise, holes counter-clockwise.
      const ccw = planarSignedArea(ring) > 0;
      const wantCcw = r > 0;
      if (ccw !== wantCcw) {
        rings.push(flip(ringsArcs[r]));
        flippedRings += 1;
      } else {
        rings.push(ringsArcs[r]);
      }
    });
    keptPolys.push(rings);
  });

  if (keptPolys.length === 0) fail(`state ${g.properties.gwcode} ${g.properties.country_name} has no geometry left after processing`);
  if (keptPolys.length === 1) {
    g.type = 'Polygon';
    g.arcs = keptPolys[0];
  } else {
    g.type = 'MultiPolygon';
    g.arcs = keptPolys;
  }
}

// ---------- validate final geometry with spherical maths ----------
const TWO_PI = 2 * Math.PI;
const rowInfo = [];
let usedVertices = new Set();
for (const g of geomsOut) {
  const decoded = decode(topo, g);
  let steradians = 0;
  for (const poly of polygonsOf(decoded)) {
    const a = geoArea({ type: 'Polygon', coordinates: poly });
    if (!(a > 0) || a > TWO_PI) fail(`bad winding or empty polygon in gw ${g.properties.gwcode} (${g.properties.start}): area ${a}`);
    steradians += a;
    for (const ring of poly) for (const c of ring) if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) fail('non-finite coordinate');
  }
  rowInfo.push({ g, areaKm2: steradians * EARTH_RADIUS_KM * EARTH_RADIUS_KM });
  for (const i of arcIndexes(g.arcs)) usedVertices.add(i);
}
// Drop arcs no longer referenced (collapsed rings) by compacting would renumber everything; keep it simple.
const verticesAfter = arcCount(topo);

// ---------- normalise properties ----------
const round = (n, step) => Math.round(n / step) * step;
const idCheck = new Set();
for (const { g, areaKm2 } of rowInfo) {
  const p = g.properties;
  g.id = p.gwcode;
  g.properties = {
    gw: p.gwcode,
    name: p.country_name,
    start: p.start,
    end: p.end,
    status: STATUS.get(p.status),
    owner: Number(p.owner),
    bDef: p.b_def === 1,
    capital: p.capname || null,
    capLng: Number.isFinite(p.caplong) ? Math.round(p.caplong * 1000) / 1000 : null,
    capLat: Number.isFinite(p.caplat) ? Math.round(p.caplat * 1000) / 1000 : null,
    areaKm2: round(areaKm2, 100),
    fid: p.fid,
  };
  if (idCheck.has(p.fid)) fail(`duplicate fid ${p.fid}`);
  idCheck.add(p.fid);
}

// ---------- computed events ----------
const dayMs = 86_400_000;
const addDay = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

const byState = new Map();
for (const { g } of rowInfo) {
  const list = byState.get(g.properties.gw) ?? [];
  list.push(g.properties);
  byState.set(g.properties.gw, list);
}

const events = [];
const push = (e) => events.push(e);

for (const [gw, rows] of byState) {
  rows.sort((a, b) => a.start.localeCompare(b.start));
  const first = rows[0];
  if (first.start > COVERAGE.start) {
    push({
      date: first.start,
      gw,
      type: 'appears',
      importance: first.status === 'independent' ? 'major' : 'minor',
      toStatus: first.status,
      toOwner: first.owner,
      areaAfterKm2: first.areaKm2,
    });
  }
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const gap = daysBetween(a.end, b.start);
    if (gap > 1) {
      push({ date: addDay(a.end, 1), gw, type: 'ends', importance: a.status === 'independent' ? 'major' : 'minor', fromStatus: a.status, fromOwner: a.owner, areaBeforeKm2: a.areaKm2, gapUntil: b.start });
      push({ date: b.start, gw, type: 'appears', importance: b.status === 'independent' ? 'major' : 'minor', toStatus: b.status, toOwner: b.owner, areaAfterKm2: b.areaKm2, reappears: true });
      continue;
    }
    const statusChanged = a.status !== b.status || a.owner !== b.owner;
    const delta = b.areaKm2 - a.areaKm2;
    const rel = a.areaKm2 > 0 ? Math.abs(delta) / a.areaKm2 : 0;
    if (statusChanged) {
      const involvesIndependence = a.status === 'independent' || b.status === 'independent';
      push({ date: b.start, gw, type: 'status', importance: involvesIndependence ? 'major' : 'minor', fromStatus: a.status, toStatus: b.status, fromOwner: a.owner, toOwner: b.owner, areaBeforeKm2: a.areaKm2, areaAfterKm2: b.areaKm2, areaDeltaKm2: round(delta, 100) });
    } else if (Math.abs(delta) >= 1500 && rel >= 0.002) {
      const big = Math.abs(delta) >= 100_000 || rel >= 0.1;
      push({ date: b.start, gw, type: 'territory', importance: big ? 'major' : 'minor', areaBeforeKm2: a.areaKm2, areaAfterKm2: b.areaKm2, areaDeltaKm2: round(delta, 100) });
    }
  }
  const last = rows[rows.length - 1];
  if (last.end < COVERAGE.end) {
    push({ date: addDay(last.end, 1), gw, type: 'ends', importance: last.status === 'independent' ? 'major' : 'minor', fromStatus: last.status, fromOwner: last.owner, areaBeforeKm2: last.areaKm2 });
  }
}
events.sort((a, b) => a.date.localeCompare(b.date) || a.gw - b.gw || a.type.localeCompare(b.type));
events.forEach((e, i) => { e.id = `c${String(i + 1).padStart(4, '0')}`; });

// ---------- states table (latest dataset label per state; used for owner names and fallbacks) ----------
const states = {};
for (const [gw, rows] of byState) {
  states[gw] = { name: rows[rows.length - 1].name, first: rows[0].start, last: rows[rows.length - 1].end, rows: rows.length };
}

// ---------- write ----------
mkdirSync(OUT_DIR, { recursive: true });
const topoPath = resolve(OUT_DIR, 'cshapes-gw.topo.json');
writeFileSync(topoPath, JSON.stringify(topo));

const counts = {};
for (const { g } of rowInfo) counts[g.properties.status] = (counts[g.properties.status] ?? 0) + 1;

const meta = {
  schema: 1,
  dataset: {
    name: 'CShapes 2.0 (Gleditsch–Ward system membership)',
    version: '2.0',
    coverage: COVERAGE,
    rows: rowInfo.length,
    states: byState.size,
    rowsByStatus: counts,
    undefinedBoundaryRows: rowInfo.filter(({ g }) => !g.properties.bDef).length,
  },
  license: {
    name: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    summary:
      'Attribution, NonCommercial, ShareAlike. The CShapes project page states CC BY-NC-SA 4.0; the ETH Research Collection record for the paper lists CC BY-NC 4.0; the R package is GPL (>= 2). The strictest terms are applied here.',
    adapted:
      'This file is an adaptation: geometry was simplified and quantised, properties were renamed, and areas and events were computed. Redistribution of this file must remain under CC BY-NC-SA 4.0 and non-commercial.',
  },
  citation:
    'Schvitz, G., Girardin, L., Rüegger, S., Weidmann, N. B., Cederman, L.-E., & Gleditsch, K. S. (2022). Mapping the International System, 1886–2019: The CShapes 2.0 Dataset. Journal of Conflict Resolution, 66(1), 144–161. https://doi.org/10.1177/00220027211013563',
  source: {
    homepage: 'https://icr.ethz.ch/data/cshapes/',
    obtainedFrom: 'https://github.com/cran/cshapes (read-only CRAN mirror), file inst/extdata/cshapes_2_gw.topojson.xz, cshapes 2.0 packaged 2021-06-05',
    archiveMd5: xzPath ? createHash('md5').update(readFileSync(xzPath)).digest('hex') : null,
    inputSha256,
  },
  processing: {
    tool: 'scripts/build-history.mjs',
    simplifyWeightSqDeg: WEIGHT,
    quantization: QUANTIZATION,
    verticesBefore,
    verticesAfter,
    ringsDropped: droppedRings,
    ringsRewound: flippedRings,
    statesRestoredAtFullDetail: [...restoredStates],
  },
  states,
  events,
};
writeFileSync(resolve(OUT_DIR, 'meta.json'), JSON.stringify(meta));

const kb = (p) => (statSync(p).size / 1024).toFixed(0);
const byType = {};
for (const e of events) byType[`${e.type}/${e.importance}`] = (byType[`${e.type}/${e.importance}`] ?? 0) + 1;
console.log(`Wrote ${topoPath} (${kb(topoPath)} KB) and meta.json (${kb(resolve(OUT_DIR, 'meta.json'))} KB)`);
console.log(`Vertices ${verticesBefore} -> ${verticesAfter}; rings dropped ${droppedRings}; rings rewound ${flippedRings}`);
console.log(`States restored at full detail: ${[...restoredStates].join('; ') || 'none'}`);
console.log(`Rows ${rowInfo.length}, states ${byState.size}, events ${events.length}`, byType);
console.log(`Input sha256 ${inputSha256}`);
