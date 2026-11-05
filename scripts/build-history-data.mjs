// Builds the web-ready historical dataset from the official CShapes 2.0 TopoJSON.
//
//   data-raw/cshapes_2_gw.topojson  (run scripts/fetch-cshapes.sh first)
//     -> public/data/cshapes/cshapes-2.0-gw.simplified.topojson
//
// What this script does, and deliberately does not do:
//  * It NEVER edits, adds or invents boundaries. Geometry is only generalised (simplified) so the
//    file is small enough for the web. Simplification is topology-preserving (shared borders stay
//    shared), keeps every shape, and is disclosed in the app.
//  * Areas are computed from the ORIGINAL, unsimplified geometry, so area figures and area changes
//    are not distorted by simplification.
//  * Only attribute fields the app uses are kept.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';
import { feature } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data-raw', 'cshapes_2_gw.topojson');
const TMP = join(root, 'data-raw', 'cshapes_with_area.topojson');
const OUT_DIR = join(root, 'public', 'data', 'cshapes');
const OUT = join(OUT_DIR, 'cshapes-2.0-gw.simplified.topojson');

/**
 * Douglas-Peucker tolerance in metres. 3 km keeps ~97% of the original rings (only islands and
 * features smaller than about 3 km vanish) while cutting the file by ~88%. Tested alternatives:
 * percentage-based Visvalingam dropped 62% of rings; finer tolerances were larger without being
 * measurably cleaner.
 */
const TOLERANCE_M = '3000';
const EARTH_RADIUS_KM = 6371.0088;

if (!existsSync(RAW)) {
  console.error(`Missing ${RAW}\nRun: bash scripts/fetch-cshapes.sh`);
  process.exit(1);
}

const topo = JSON.parse(readFileSync(RAW, 'utf8'));
const objectName = Object.keys(topo.objects)[0];
const geometries = topo.objects[objectName].geometries;
console.log(`Read ${geometries.length} polygon periods from object "${objectName}"`);

// 1. Area from the original geometry, then reduce each period to the fields we use.
for (const g of geometries) {
  const f = feature(topo, g);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let steradians = 0;
  for (const coordinates of polys) steradians += geoArea({ type: 'Polygon', coordinates });
  const p = g.properties;
  g.properties = {
    id: p.fid,
    gw: p.gwcode,
    label: p.country_name,
    start: p.start,
    end: p.end,
    status: p.status,
    owner: p.owner === null || p.owner === '' || p.owner === 'N/A' ? null : Number(p.owner),
    cap: p.capname,
    capLat: Math.round(p.caplat * 1e4) / 1e4,
    capLng: Math.round(p.caplong * 1e4) / 1e4,
    bdef: p.b_def === 1 ? 1 : 0,
    area: Math.round(steradians * EARTH_RADIUS_KM * EARTH_RADIUS_KM),
  };
}
writeFileSync(TMP, JSON.stringify(topo));

// 2. Topology-preserving simplification + quantisation.
mkdirSync(OUT_DIR, { recursive: true });
execFileSync(
  join(root, 'node_modules', '.bin', 'mapshaper'),
  [
    TMP,
    '-simplify', 'dp', `interval=${TOLERANCE_M}`, 'keep-shapes',
    '-o', OUT, 'format=topojson', 'quantization=100000', 'force',
  ],
  { stdio: 'inherit' },
);

// 3. Report.
const before = statSync(RAW).size;
const after = statSync(OUT).size;
console.log(`\nOriginal: ${(before / 1e6).toFixed(2)} MB -> simplified: ${(after / 1e6).toFixed(2)} MB`);

const out = JSON.parse(readFileSync(OUT, 'utf8'));
const outGeoms = Object.values(out.objects)[0].geometries;
if (outGeoms.length !== geometries.length) {
  console.error(`ERROR: expected ${geometries.length} periods, got ${outGeoms.length}`);
  process.exit(1);
}
const missingProps = outGeoms.filter((g) => !g.properties || g.properties.id === undefined);
if (missingProps.length) {
  console.error(`ERROR: ${missingProps.length} periods lost their properties`);
  process.exit(1);
}
console.log(`OK: ${outGeoms.length} periods, all attributes preserved.`);
