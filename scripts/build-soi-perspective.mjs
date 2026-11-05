/**
 * Build Script: India's Official Territorial Perspective TopoJSON Generator
 *
 * PROVENANCE & DATASET NATURE:
 * IMPORTANT: This file generates an academic derivative dataset modeling the official territorial
 * claims of India. It is NOT an official GIS dataset surveyed, vectorized, or published by the
 * Survey of India or the Government of India.
 *
 * Underlying Geometry Derivation:
 * - Base Datasets:
 *     1. Natural Earth 1:110m (public/data/countries-110m.json, with Arc 399 Tawang restoration) - Public Domain / ISC
 *     2. CShapes 2.0 (public/data/cshapes/cshapes-2.0-gw.simplified.topojson, ETH Zurich / Schvitz et al. 2022) - CC BY-NC-SA 4.0
 * - Splicing & Reconstruction:
 *     - British India 1946 external boundary arcs (CShapes GW 750: arcs 5052, 5053, 4286, 4285) are
 *       spliced with Natural Earth arcs (395, 406, 396) onto the Natural Earth TopoJSON quantization grid.
 *
 * Cartographic Perspective Modeled:
 * - Reflects the boundary alignment of the Survey of India (SOI) Political Map of India (9th Edition, 2019)
 *   and Ministry of External Affairs (MEA) territorial position:
 *     1. Entire former princely state of Jammu & Kashmir under the 1947 Instrument of Accession,
 *        including Pakistan-administered Kashmir (PoK), Gilgit-Baltistan, Aksai Chin, Siachen, and K2.
 *     2. 1914 Simla Convention (McMahon Line) for Arunachal Pradesh (including Tawang).
 *     3. 1865 Johnson Line along the Kunlun Mountains crest watershed for northern Aksai Chin.
 *     4. Afghanistan–India constitutional border along the Wakhan Corridor (~106 km de jure claim;
 *        present-day operational administration is governed de facto by Pakistan and Afghanistan).
 *
 * Licensing:
 * - Because this dataset incorporates extracted coordinate arcs from CShapes 2.0, this derivative
 *   is strictly subject to Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 *   (CC BY-NC-SA 4.0). It must be used non-commercially with appropriate attribution.
 */

import * as fs from 'fs';
import * as path from 'path';

const atlasPath = path.resolve('public/data/countries-110m.json');
const csPath = path.resolve('public/data/cshapes/cshapes-2.0-gw.simplified.topojson');
const outPath = path.resolve('public/data/countries-110m-soi.json');

const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
const cs = JSON.parse(fs.readFileSync(csPath, 'utf8'));

const scale = atlas.transform.scale;
const trans = atlas.transform.translate;

function quantize(lng, lat) {
  return [
    Math.round((lng - trans[0]) / scale[0]),
    Math.round((lat - trans[1]) / scale[1]),
  ];
}

function decodeAtlasArc(arc) {
  let [x, y] = [0, 0];
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [
      x * scale[0] + trans[0],
      y * scale[1] + trans[1],
    ];
  });
}

function decodeCsArc(arc) {
  let [x, y] = [0, 0];
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [
      x * cs.transform.scale[0] + cs.transform.translate[0],
      y * cs.transform.scale[1] + cs.transform.translate[1],
    ];
  });
}

function encodeArc(pts) {
  let [prevX, prevY] = [0, 0];
  return pts.map(([lng, lat], idx) => {
    const [qx, qy] = quantize(lng, lat);
    if (idx === 0) {
      prevX = qx;
      prevY = qy;
      return [qx, qy];
    }
    const delta = [qx - prevX, qy - prevY];
    prevX = qx;
    prevY = qy;
    return delta;
  });
}

// 1. Arc_IndoPak_Radcliffe (from Rann of Kutch to Sialkot border [74.451, 32.765])
const pts395 = decodeAtlasArc(atlas.arcs[395]);
const ptsRadcliffe = pts395.slice(0, 16);

// 2. Arc_IndoPak_Kashmir (from [74.451, 32.765] up to [73.641, 36.901])
const pts5052 = decodeCsArc(cs.arcs[5052]);
const pts5053 = decodeCsArc(cs.arcs[5053]);
const ptsKashmirBorder = [
  ptsRadcliffe[ptsRadcliffe.length - 1],
  ...pts5053.slice().reverse().slice(1),
  ...pts5052.slice().reverse().slice(1),
];

// 3. Arc_PakAfghan (from [60.875, 29.829] to [73.641, 36.901])
const pts406 = decodeAtlasArc(atlas.arcs[406]);
const ptsPakAfghan = [
  ...pts406.slice(0, 26),
  ptsKashmirBorder[ptsKashmirBorder.length - 1],
];

// 4. Arc_IndoAfghan (from [73.641, 36.901] to [75.160, 37.134])
const ptsIndoAfghan = [
  ptsKashmirBorder[ptsKashmirBorder.length - 1],
  ...pts406.slice(26),
];

// 5. Arc_IndoChina_North (from [75.160, 37.134] to [80.160, 35.444])
const pts4286 = decodeCsArc(cs.arcs[4286]);
const ptsIndoChinaNorth = [
  ptsIndoAfghan[ptsIndoAfghan.length - 1],
  ...pts4286.slice().reverse().slice(1),
];

// 6. Arc_IndoChina_Aksai (from [80.160, 35.444] to Pangong Tso)
const pts4285 = decodeCsArc(cs.arcs[4285]);
const pts396 = decodeAtlasArc(atlas.arcs[396]);
const ptsIndoChinaAksai = [
  ptsIndoChinaNorth[ptsIndoChinaNorth.length - 1],
  ...pts4285.slice().reverse().slice(1, -1),
  pts396[1],
];

// 7. Arc_IndoChina_South (from Pangong Tso [78.911, 34.322] to Nepal [81.111, 30.184])
const ptsIndoChinaSouth = pts396.slice(1);

const soiTopo = JSON.parse(JSON.stringify(atlas));
const newArcs = [...soiTopo.arcs];

const idxRadcliffe = newArcs.length;
newArcs.push(encodeArc(ptsRadcliffe));

const idxKashmir = newArcs.length;
newArcs.push(encodeArc(ptsKashmirBorder));

const idxPakAfghan = newArcs.length;
newArcs.push(encodeArc(ptsPakAfghan));

const idxIndoAfghan = newArcs.length;
newArcs.push(encodeArc(ptsIndoAfghan));

const idxIndoChinaNorth = newArcs.length;
newArcs.push(encodeArc(ptsIndoChinaNorth));

const idxIndoChinaAksai = newArcs.length;
newArcs.push(encodeArc(ptsIndoChinaAksai));

const idxIndoChinaSouth = newArcs.length;
newArcs.push(encodeArc(ptsIndoChinaSouth));

soiTopo.arcs = newArcs;

// Update India (356)
const indiaGeom = soiTopo.objects.countries.geometries.find((g) => g.id === '356');
indiaGeom.arcs = [
  [
    -383,
    393,
    394,
    idxRadcliffe,
    idxKashmir,
    idxIndoAfghan,
    idxIndoChinaNorth,
    idxIndoChinaAksai,
    idxIndoChinaSouth,
    397,
    398,
    399,
    400,
  ],
];

// Update Pakistan (586)
const pakGeom = soiTopo.objects.countries.geometries.find((g) => g.id === '586');
pakGeom.arcs = [
  [
    404,
    405,
    idxPakAfghan,
    ~idxKashmir,
    ~idxRadcliffe,
  ],
];

// Update Afghanistan (004)
const afghGeom = soiTopo.objects.countries.geometries.find((g) => g.id === '004');
const afghArcs = afghGeom.arcs[0];
const idx407InAfgh = afghArcs.indexOf(-407);
afghGeom.arcs = [
  [
    ...afghArcs.slice(0, idx407InAfgh),
    ~idxIndoAfghan,
    ~idxPakAfghan,
    ...afghArcs.slice(idx407InAfgh + 1),
  ],
];

// Update China (156)
const chinaGeom = soiTopo.objects.countries.geometries.find((g) => g.id === '156');
chinaGeom.arcs = chinaGeom.arcs.map((polygon) =>
  polygon.map((ring) => {
    const res = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      if (a === -408) {
        continue;
      } else if (a === -397) {
        res.push(~idxIndoChinaSouth, ~idxIndoChinaAksai, ~idxIndoChinaNorth);
      } else {
        res.push(a);
      }
    }
    return res;
  })
);

fs.writeFileSync(outPath, JSON.stringify(soiTopo));
console.log('Successfully generated', outPath);
