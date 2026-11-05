import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { geoContains, geoArea } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { CountryProperties } from '../../types/geo';
import { createHistoryService } from '../../history/historyService';

describe('Tier 3: Atlas Geometry & Tawang Restoration', () => {
  const atlasPath = path.resolve(__dirname, '../../../public/data/countries-110m.json');
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf-8')) as Topology<{
    countries: GeometryCollection<CountryProperties>;
  }>;
  const countriesCollection = feature(atlas, atlas.objects.countries);
  const countries = countriesCollection.features;

  describe('Atlas TopoJSON Structure & Integrity', () => {
    it('contains exactly 177 country geometries and valid transform', () => {
      expect(countries.length).toBe(177);
      expect(atlas.transform).toBeDefined();
      expect(atlas.transform?.scale[0]).toBeGreaterThan(0);
      expect(atlas.transform?.scale[1]).toBeGreaterThan(0);
    });

    it('contains India, Bhutan, and China with valid geometry types', () => {
      const india = countries.find((c) => c.id === '356');
      const bhutan = countries.find((c) => c.id === '064');
      const china = countries.find((c) => c.id === '156');

      expect(india).toBeDefined();
      expect(india?.properties.name).toBe('India');
      expect(india?.geometry.type).toBe('Polygon');

      expect(bhutan).toBeDefined();
      expect(bhutan?.properties.name).toBe('Bhutan');
      expect(bhutan?.geometry.type).toBe('Polygon');

      expect(china).toBeDefined();
      expect(china?.properties.name).toBe('China');
      expect(china?.geometry.type).toBe('MultiPolygon');
    });

    it('preserves topological boundary contiguity between India and Bhutan', () => {
      const bhutanGeom = atlas.objects.countries.geometries.find((g) => g.id === '064');
      const indiaGeom = atlas.objects.countries.geometries.find((g) => g.id === '356');

      expect(bhutanGeom).toBeDefined();
      expect(indiaGeom).toBeDefined();

      // India uses arc 399 in positive direction; Bhutan uses arc 399 in reverse (~399 = -400)
      const indiaArcs = (indiaGeom as { arcs: number[][] }).arcs[0];
      const bhutanArcs = (bhutanGeom as { arcs: number[][] }).arcs[0];

      expect(indiaArcs).toContain(399);
      expect(bhutanArcs).toContain(-400);

      // Verify endpoint contiguity
      let [x, y] = [0, 0];
      const arc399 = atlas.arcs[399];
      for (const [dx, dy] of arc399) {
        x += dx;
        y += dy;
      }
      expect(x).toBe(75471);
      expect(y).toBe(66988);
    });
  });

  describe('Point-in-Polygon Geolocation Verification', () => {
    it('restores Tawang inside India and outside Bhutan', () => {
      const tawang: [number, number] = [91.87, 27.59];
      const india = countries.find((c) => c.id === '356')!;
      const bhutan = countries.find((c) => c.id === '064')!;

      expect(geoContains(india, tawang)).toBe(true);
      expect(geoContains(bhutan, tawang)).toBe(false);
    });

    it('preserves Bhutanese cities inside Bhutan', () => {
      const thimphu: [number, number] = [89.63, 27.47];
      const trashigang: [number, number] = [91.55, 27.33];
      const bhutan = countries.find((c) => c.id === '064')!;
      const india = countries.find((c) => c.id === '356')!;

      expect(geoContains(bhutan, thimphu)).toBe(true);
      expect(geoContains(india, thimphu)).toBe(false);

      expect(geoContains(bhutan, trashigang)).toBe(true);
      expect(geoContains(india, trashigang)).toBe(false);
    });

    it('preserves neighboring Indian and Chinese locations', () => {
      const bomdila: [number, number] = [92.42, 27.26];
      const guwahati: [number, number] = [91.74, 26.18];
      const lhasa: [number, number] = [91.13, 29.65];

      const india = countries.find((c) => c.id === '356')!;
      const china = countries.find((c) => c.id === '156')!;

      expect(geoContains(india, bomdila)).toBe(true);
      expect(geoContains(india, guwahati)).toBe(true);
      expect(geoContains(china, lhasa)).toBe(true);
    });

    it('conserves total surface area across the shared boundary', () => {
      const india = countries.find((c) => c.id === '356')!;
      const bhutan = countries.find((c) => c.id === '064')!;

      const indiaArea = geoArea(india);
      const bhutanArea = geoArea(bhutan);

      expect(indiaArea).toBeGreaterThan(0.07);
      expect(bhutanArea).toBeGreaterThan(0.0009);

      // Combined area matches expected sum within 1e-12 precision
      const combined = indiaArea + bhutanArea;
      expect(Math.abs(combined - 0.07858787716615767)).toBeLessThan(1e-12);
    });
  });

  describe('Historical Baseline (CShapes 2.0) Verification', () => {
    const cshapesPath = path.resolve(__dirname, '../../../public/data/cshapes/cshapes-2.0-gw.simplified.topojson');
    const cshapesTopo = JSON.parse(fs.readFileSync(cshapesPath, 'utf-8'));
    const historyService = createHistoryService(cshapesTopo);

    it('CShapes preserves authentic historical evolution of Tawang (Qing in 1900, India in 1950, 1980, 2019; never Bhutan)', () => {
      const tawang: [number, number] = [91.87, 27.59];

      // 1900: Before 1914 Simla Convention / McMahon Line, Tawang is under Qing / Tibet (GW 710)
      const snap1900 = historyService.snapshot(1900, 'mid');
      if (snap1900.covered) {
        const qing = snap1900.features.find((f) => f.properties.gw === 710);
        expect(qing).toBeDefined();
        expect(geoContains(qing!, tawang)).toBe(true);

        const bhutan = snap1900.features.find((f) => f.properties.gw === 760);
        if (bhutan) expect(geoContains(bhutan, tawang)).toBe(false);
      }

      // 1950, 1980, 2019: Modern India (GW 750)
      for (const year of [1950, 1980, 2019]) {
        const snap = historyService.snapshot(year, 'mid');
        expect(snap.covered).toBe(true);
        if (snap.covered) {
          const indiaFeature = snap.features.find((f) => f.properties.gw === 750);
          expect(indiaFeature).toBeDefined();
          expect(geoContains(indiaFeature!, tawang)).toBe(true);

          const bhutanFeature = snap.features.find((f) => f.properties.gw === 760);
          if (bhutanFeature) {
            expect(geoContains(bhutanFeature, tawang)).toBe(false);
          }
        }
      }
    });
  });
});
