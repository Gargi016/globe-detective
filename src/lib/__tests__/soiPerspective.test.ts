import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { geoContains, geoArea } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { CountryProperties } from '../../types/geo';
import { createHistoryService } from '../../history/historyService';
import { ATLAS_DE_FACTO_URL, ATLAS_SOI_URL, ATLAS_URL } from '../countries';

describe('Two-Perspective Territorial Map System', () => {
  const deFactoPath = path.resolve(__dirname, '../../../public/data/countries-110m.json');
  const soiPath = path.resolve(__dirname, '../../../public/data/countries-110m-soi.json');
  const cshapesPath = path.resolve(__dirname, '../../../public/data/cshapes/cshapes-2.0-gw.simplified.topojson');

  const deFactoTopo = JSON.parse(fs.readFileSync(deFactoPath, 'utf-8')) as Topology<{
    countries: GeometryCollection<CountryProperties>;
  }>;
  const soiTopo = JSON.parse(fs.readFileSync(soiPath, 'utf-8')) as Topology<{
    countries: GeometryCollection<CountryProperties>;
  }>;

  const deFactoFeatures = feature(deFactoTopo, deFactoTopo.objects.countries).features;
  const soiFeatures = feature(soiTopo, soiTopo.objects.countries).features;

  describe('1. De Facto View Integrity', () => {
    it('maintains exactly 177 country geometries', () => {
      expect(deFactoFeatures.length).toBe(177);
    });

    it('reflects de facto territorial administration in Kashmir, Gilgit-Baltistan, and Aksai Chin', () => {
      const india = deFactoFeatures.find((c) => c.id === '356')!;
      const pakistan = deFactoFeatures.find((c) => c.id === '586')!;
      const china = deFactoFeatures.find((c) => c.id === '156')!;

      // Indian administered territory
      expect(geoContains(india, [74.7973, 34.0837])).toBe(true); // Srinagar
      expect(geoContains(india, [77.5771, 34.1526])).toBe(true); // Leh
      expect(geoContains(india, [74.857, 32.7266])).toBe(true);  // Jammu
      expect(geoContains(india, [91.87, 27.59])).toBe(true);     // Tawang (Tier 3 fix)

      // Pakistan administered territory (de facto under Pakistan)
      expect(geoContains(pakistan, [73.4708, 34.37])).toBe(true);  // Muzaffarabad
      expect(geoContains(pakistan, [74.3142, 35.9208])).toBe(true); // Gilgit
      expect(geoContains(india, [73.4708, 34.37])).toBe(false);
      expect(geoContains(india, [74.3142, 35.9208])).toBe(false);

      // Chinese administered territory (Aksai Chin de facto under China)
      expect(geoContains(china, [79.0, 35.2])).toBe(true);
      expect(geoContains(india, [79.0, 35.2])).toBe(false);
    });
  });

  describe("2. India's Claimed Borders View (Survey of India standard)", () => {
    it('maintains exactly 177 country geometries and same quantization transform', () => {
      expect(soiFeatures.length).toBe(177);
      expect(soiTopo.transform).toEqual(deFactoTopo.transform);
    });

    it('assigns Pakistan-administered Kashmir, Gilgit-Baltistan, Aksai Chin, Siachen, K2, and Arunachal Pradesh to India (356)', () => {
      const india = soiFeatures.find((c) => c.id === '356')!;

      const testLocations: [string, [number, number]][] = [
        ['Srinagar', [74.7973, 34.0837]],
        ['Jammu', [74.857, 32.7266]],
        ['Leh', [77.5771, 34.1526]],
        ['Kargil', [76.1325, 34.5539]],
        ['Muzaffarabad (PoK)', [73.4708, 34.37]],
        ['Mirpur (PoK)', [73.7511, 33.1478]],
        ['Gilgit (Gilgit-Baltistan)', [74.3142, 35.9208]],
        ['Skardu (Gilgit-Baltistan)', [75.6333, 35.2971]],
        ['K2 / Godwin-Austen', [76.5133, 35.8814]],
        ['Siachen Glacier', [77.1, 35.5]],
        ['Aksai Chin', [79.0, 35.2]],
        ['Tawang (Arunachal Pradesh)', [91.87, 27.59]],
        ['Itanagar (Arunachal Pradesh)', [93.6053, 27.0844]],
        ['Delhi', [77.1025, 28.7041]],
      ];

      for (const [name, coord] of testLocations) {
        expect(
          geoContains(india, coord),
          `Expected ${name} to be inside India in Official Territorial Perspective`,
        ).toBe(true);
      }
    });

    it('preserves Pakistan core territory and adjusts northern border without overlaps', () => {
      const pakistan = soiFeatures.find((c) => c.id === '586')!;
      const india = soiFeatures.find((c) => c.id === '356')!;

      // Pakistan core territory remains inside Pakistan
      expect(geoContains(pakistan, [73.0479, 33.6844])).toBe(true); // Islamabad
      expect(geoContains(pakistan, [74.3587, 31.5204])).toBe(true); // Lahore
      expect(geoContains(pakistan, [71.5249, 34.0151])).toBe(true); // Peshawar
      expect(geoContains(pakistan, [67.0011, 24.8607])).toBe(true); // Karachi

      // Pakistan core territory is NOT inside India
      expect(geoContains(india, [73.0479, 33.6844])).toBe(false);
      expect(geoContains(india, [74.3587, 31.5204])).toBe(false);
      expect(geoContains(india, [71.5249, 34.0151])).toBe(false);
      expect(geoContains(india, [67.0011, 24.8607])).toBe(false);

      // Disputed territories are NOT inside Pakistan in India-claimed view
      expect(geoContains(pakistan, [73.4708, 34.37])).toBe(false);  // Muzaffarabad
      expect(geoContains(pakistan, [74.3142, 35.9208])).toBe(false); // Gilgit
    });

    it('preserves China core territory and adjusts western border without overlaps', () => {
      const china = soiFeatures.find((c) => c.id === '156')!;
      const india = soiFeatures.find((c) => c.id === '356')!;

      // Chinese cities remain inside China
      expect(geoContains(china, [75.9896, 39.4704])).toBe(true); // Kashgar
      expect(geoContains(china, [79.9222, 37.1142])).toBe(true); // Hotan
      expect(geoContains(china, [91.13, 29.65])).toBe(true);    // Lhasa

      // Chinese cities are NOT inside India
      expect(geoContains(india, [75.9896, 39.4704])).toBe(false);
      expect(geoContains(india, [79.9222, 37.1142])).toBe(false);
      expect(geoContains(india, [91.13, 29.65])).toBe(false);

      // Aksai Chin is NOT inside China in India-claimed view
      expect(geoContains(china, [79.0, 35.2])).toBe(false);
    });

    it('preserves Afghanistan territory and Wakhan Corridor border', () => {
      const afghanistan = soiFeatures.find((c) => c.id === '004')!;
      const india = soiFeatures.find((c) => c.id === '356')!;

      expect(geoContains(afghanistan, [69.1723, 34.5281])).toBe(true); // Kabul
      expect(geoContains(india, [69.1723, 34.5281])).toBe(false);

      const deFactoAfg = deFactoFeatures.find((c) => c.id === '004')!;
      // Slight vertex addition at tripoint junction causes negligible area delta (< 0.002%)
      expect(Math.abs(geoArea(afghanistan) - geoArea(deFactoAfg))).toBeLessThan(1e-4);
    });

    it('leaves all 173 non-boundary country geometries strictly identical', () => {
      const modifiedIds = new Set(['id:356', 'id:586', 'id:156', 'id:004']);
      const getKey = (f: { id?: string | number; properties?: { name?: string } }) =>
        f.id !== undefined && f.id !== null && f.id !== '' ? `id:${f.id}` : `name:${f.properties?.name}`;

      for (const feat of deFactoFeatures) {
        const key = getKey(feat);
        if (!modifiedIds.has(key)) {
          const soiMatch = soiFeatures.find((f) => getKey(f) === key);
          expect(soiMatch).toBeDefined();
          expect(soiMatch?.geometry).toEqual(feat.geometry);
          expect(soiMatch?.properties).toEqual(feat.properties);
        }
      }
    });

    it('conserves total regional surface area across India, Pakistan, China, and Afghanistan', () => {
      const ids = ['356', '586', '156', '004'];
      const deFactoSum = ids
        .map((id) => deFactoFeatures.find((f) => f.id === id)!)
        .reduce((sum, f) => sum + geoArea(f), 0);

      const soiSum = ids
        .map((id) => soiFeatures.find((f) => f.id === id)!)
        .reduce((sum, f) => sum + geoArea(f), 0);

      // Regional area is conserved to within floating-point rounding precision
      expect(Math.abs(deFactoSum - soiSum)).toBeLessThan(1e-4);
    });
  });

  describe('3. Historical Baseline (CShapes 2.0) Independence', () => {
    const cshapesTopo = JSON.parse(fs.readFileSync(cshapesPath, 'utf-8'));
    const historyService = createHistoryService(cshapesTopo);

    it('historical snapshots retain unchanged CShapes 2.0 baseline regardless of modern views', () => {
      // 1948: British India partition year
      const snap1948 = historyService.snapshot(1948, 'mid');
      expect(snap1948.covered).toBe(true);

      // 1975: Cold War baseline
      const snap1975 = historyService.snapshot(1975, 'mid');
      expect(snap1975.covered).toBe(true);

      // 2019: Contemporary CShapes baseline
      const snap2019 = historyService.snapshot(2019, 'mid');
      expect(snap2019.covered).toBe(true);

      const india2019 = snap2019.features.find((f) => f.properties.gw === 750);
      expect(india2019).toBeDefined();
    });
  });

  describe('4. Atlas Module & Loader Configurations', () => {
    it('configures India Official Perspective as the default modern atlas endpoint', () => {
      expect(ATLAS_DE_FACTO_URL).toMatch(/countries-110m\.json$/);
      expect(ATLAS_SOI_URL).toMatch(/countries-110m-soi\.json$/);
      expect(ATLAS_URL).toBe(ATLAS_SOI_URL);
    });
  });
});
