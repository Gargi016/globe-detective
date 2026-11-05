// Reports ring self-intersections in one or more TopoJSON files (usage: node scripts/verify-geometry.mjs <file...>).
// The original CShapes data has none; the simplified output may keep a few microscopic bow-ties.
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';

function cross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}
function ringSelfIntersections(ring) {
  const n = ring.length - 1;
  const cell = 0.5, grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    const cx1 = Math.floor(Math.min(x1, x2) / cell), cx2 = Math.floor(Math.max(x1, x2) / cell);
    const cy1 = Math.floor(Math.min(y1, y2) / cell), cy2 = Math.floor(Math.max(y1, y2) / cell);
    if ((cx2 - cx1 + 1) * (cy2 - cy1 + 1) > 400) continue;
    for (let cx = cx1; cx <= cx2; cx++) for (let cy = cy1; cy <= cy2; cy++) {
      const k = cx + ',' + cy; (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
    }
  }
  const seen = new Set(); let count = 0;
  for (const idxs of grid.values()) {
    for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
      const i = idxs[a], j = idxs[b];
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const pk = i * 1e6 + j; if (seen.has(pk)) continue; seen.add(pk);
      if (cross(...ring[i], ...ring[i + 1], ...ring[j], ...ring[j + 1])) count++;
    }
  }
  return count;
}
for (const file of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(file, 'utf8'));
  const obj = Object.values(t.objects)[0];
  const fc = feature(t, obj);
  let rings = 0, badRings = 0, crossings = 0, badPolys = new Set(), pts = 0;
  for (const f of fc.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) {
      rings++; pts += ring.length;
      const c = ringSelfIntersections(ring);
      if (c) { badRings++; crossings += c; badPolys.add((f.properties.label ?? f.properties.country_name) + ' ' + (f.properties.start ?? '')); }
    }
  }
  console.log(file.split('/').pop(), '| rings', rings, '| points', pts, '| self-intersecting rings', badRings, '| crossings', crossings);
  console.log('  e.g.', [...badPolys].slice(0, 8).join('; '));
}
