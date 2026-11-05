import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  NAME_PERIODS,
  namePeriodsFor,
  resolveName,
  findNamePeriod,
  allNamesFor,
} from '../nameHistory';
import { createHistoryService } from '../historyService';

describe('Tier 2: Curated Historical Names', () => {
  describe('Period Data Integrity & Contiguity', () => {
    it('all NAME_PERIODS have valid bounds, sources, and continuous dates', () => {
      const gws = [...new Set(NAME_PERIODS.map((p) => p.gw))];
      expect(gws).toContain(710); // China
      expect(gws).toContain(640); // Turkey
      expect(gws).toContain(630); // Iran
      expect(gws).toContain(490); // DR Congo
      expect(gws).toContain(439); // Burkina Faso

      for (const gw of gws) {
        const periods = namePeriodsFor(gw);
        expect(periods.length).toBeGreaterThan(0);
        // First period should start with '' or a valid date (e.g. 552 BSAC)
        expect(periods[0].from === '' || /^\d{4}-\d{2}-\d{2}$/.test(periods[0].from)).toBe(true);
        // Ongoing states end with null; dissolved states end with their dissolution date
        const dissolvedGws = [345, 315, 265];
        if (dissolvedGws.includes(gw)) {
          expect(periods[periods.length - 1].to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        } else {
          expect(periods[periods.length - 1].to).toBeNull();
        }

        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          expect(p.name.length).toBeGreaterThan(0);
          expect(p.sources.length).toBeGreaterThan(0);
          for (const s of p.sources) {
            expect(s.label).toBeTruthy();
            expect(s.url).toMatch(/^https?:\/\//);
          }
          if (p.to !== null && p.from !== '') {
            expect(p.from <= p.to).toBe(true);
          }
          // Verify contiguity between consecutive periods
          if (i > 0) {
            const prev = periods[i - 1];
            expect(prev.to).not.toBeNull();
            const prevEnd = new Date(`${prev.to}T00:00:00Z`);
            prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
            const expectedFrom = prevEnd.toISOString().slice(0, 10);
            expect(p.from).toBe(expectedFrom);
          }
        }
      }
    });

    it('findNamePeriod accurately identifies the active NamePeriod record', () => {
      const qing = findNamePeriod(710, '1900-01-01');
      expect(qing?.name).toBe('Qing Empire');

      const ottoman = findNamePeriod(640, '1920-01-01');
      expect(ottoman?.name).toBe('Ottoman Empire');

      const turkey = findNamePeriod(640, '1930-01-01');
      expect(turkey?.name).toBe('Turkey');
    });
  });

  describe('China (GW 710)', () => {
    it('resolves Qing Empire before 1912-02-12', () => {
      const name = resolveName(710, '1905-06-01', 'China');
      expect(name.name).toBe('Qing Empire');
      expect(name.official).toContain('Great Qing');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Republic of China between 1912 and 1949', () => {
      const name = resolveName(710, '1935-01-01', 'China');
      expect(name.name).toBe('Republic of China');
      expect(name.official).toBe('Chung-hua Min-kuo');
      expect(name.provenance).toBe('verified');
    });

    it('resolves China (People\'s Republic of China) after 1949-10-01', () => {
      const name = resolveName(710, '1965-10-01', 'China');
      expect(name.name).toBe('China');
      expect(name.official).toBe("People's Republic of China");
      expect(name.provenance).toBe('verified');
    });
  });

  describe('Turkey / Ottoman Empire (GW 640)', () => {
    it('resolves Ottoman Empire prior to 29 October 1923', () => {
      const name = resolveName(640, '1914-07-01', 'Turkey (Ottoman Empire)');
      expect(name.name).toBe('Ottoman Empire');
      expect(name.official).toContain('Sublime Ottoman State');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Turkey (Republic of Turkey) from 29 October 1923 onwards', () => {
      const name = resolveName(640, '1923-10-29', 'Turkey (Ottoman Empire)');
      expect(name.name).toBe('Turkey');
      expect(name.official).toBe('Republic of Turkey');
      expect(name.provenance).toBe('verified');
    });
  });

  describe('Iran / Persia (GW 630)', () => {
    it('resolves Persia prior to 21 March 1935', () => {
      const name = resolveName(630, '1925-01-01', 'Iran (Persia)');
      expect(name.name).toBe('Persia');
      expect(name.official).toContain('Persia');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Iran (Imperial State) from 1935 until 1979 revolution', () => {
      const name = resolveName(630, '1960-01-01', 'Iran (Persia)');
      expect(name.name).toBe('Iran');
      expect(name.official).toBe('Imperial State of Iran');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Iran (Islamic Republic) after 1 April 1979', () => {
      const name = resolveName(630, '1985-01-01', 'Iran (Persia)');
      expect(name.name).toBe('Iran');
      expect(name.official).toBe('Islamic Republic of Iran');
      expect(name.provenance).toBe('verified');
    });
  });

  describe('DR Congo (GW 490)', () => {
    it('resolves Congo Free State prior to 15 November 1908', () => {
      const name = resolveName(490, '1900-01-01', 'Congo, Democratic Republic of (Zaire)');
      expect(name.name).toBe('Congo Free State');
      expect(name.official).toBe('État indépendant du Congo');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Belgian Congo between 1908 and 1960 independence', () => {
      const name = resolveName(490, '1950-01-01', 'Congo, Democratic Republic of (Zaire)');
      expect(name.name).toBe('Belgian Congo');
      expect(name.official).toBe('Congo Belge');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Congo (Léopoldville) between 1960 and 1971', () => {
      const name = resolveName(490, '1965-01-01', 'Congo, Democratic Republic of (Zaire)');
      expect(name.name).toBe('Congo (Léopoldville)');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Zaire between 27 October 1971 and 16 May 1997', () => {
      const name = resolveName(490, '1980-01-01', 'Congo, Democratic Republic of (Zaire)');
      expect(name.name).toBe('Zaire');
      expect(name.official).toBe('Republic of Zaire');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Democratic Republic of the Congo from 17 May 1997 onwards', () => {
      const name = resolveName(490, '2005-01-01', 'Congo, Democratic Republic of (Zaire)');
      expect(name.name).toBe('Democratic Republic of the Congo');
      expect(name.official).toBe('Democratic Republic of the Congo');
      expect(name.provenance).toBe('verified');
    });
  });

  describe('Burkina Faso (GW 439)', () => {
    it('resolves Upper Volta (colony) prior to 1960 independence', () => {
      const name = resolveName(439, '1950-01-01', 'Burkina Faso (Upper Volta)');
      expect(name.name).toBe('Upper Volta');
      expect(name.official).toContain('French Upper Volta');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Upper Volta (republic) between 1960 and 1984', () => {
      const name = resolveName(439, '1975-01-01', 'Burkina Faso (Upper Volta)');
      expect(name.name).toBe('Upper Volta');
      expect(name.official).toBe('Republic of Upper Volta');
      expect(name.provenance).toBe('verified');
    });

    it('resolves Burkina Faso from 4 August 1984 onwards', () => {
      const name = resolveName(439, '1995-01-01', 'Burkina Faso (Upper Volta)');
      expect(name.name).toBe('Burkina Faso');
      expect(name.provenance).toBe('verified');
    });
  });

  describe('Search and HistoryService Integration', () => {
    const topoPath = path.resolve(__dirname, '../../../public/data/cshapes/cshapes-2.0-gw.simplified.topojson');
    const topo = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
    const service = createHistoryService(topo);

    it('allNamesFor includes all historical and official names for search', () => {
      const chinaNames = allNamesFor(710);
      expect(chinaNames).toContain('Qing Empire');
      expect(chinaNames).toContain('Republic of China');
      expect(chinaNames).toContain('China');

      const turkeyNames = allNamesFor(640);
      expect(turkeyNames).toContain('Ottoman Empire');
      expect(turkeyNames).toContain('Turkey');

      const iranNames = allNamesFor(630);
      expect(iranNames).toContain('Persia');
      expect(iranNames).toContain('Iran');

      const congoNames = allNamesFor(490);
      expect(congoNames).toContain('Congo Free State');
      expect(congoNames).toContain('Belgian Congo');
      expect(congoNames).toContain('Zaire');
      expect(congoNames).toContain('Democratic Republic of the Congo');

      const burkinaNames = allNamesFor(439);
      expect(burkinaNames).toContain('Upper Volta');
      expect(burkinaNames).toContain('Burkina Faso');
    });

    it('service detects historical name changes in relevant years', () => {
      const ch1912 = service.nameChangesInYear(1912);
      expect(ch1912.some((c) => c.gw === 710 && c.to === 'Republic of China')).toBe(true);

      const ch1949 = service.nameChangesInYear(1949);
      expect(ch1949.some((c) => c.gw === 710 && c.to === 'China')).toBe(true);

      const tr1923 = service.nameChangesInYear(1923);
      expect(tr1923.some((c) => c.gw === 640 && c.to === 'Turkey')).toBe(true);

      const ir1935 = service.nameChangesInYear(1935);
      expect(ir1935.some((c) => c.gw === 630 && c.to === 'Iran')).toBe(true);

      const cg1971 = service.nameChangesInYear(1971);
      expect(cg1971.some((c) => c.gw === 490 && c.to === 'Zaire')).toBe(true);

      const cg1997 = service.nameChangesInYear(1997);
      expect(cg1997.some((c) => c.gw === 490 && c.to === 'Democratic Republic of the Congo')).toBe(true);

      const bf1984 = service.nameChangesInYear(1984);
      expect(bf1984.some((c) => c.gw === 439 && c.to === 'Burkina Faso')).toBe(true);
    });

    it('service snapshots correctly reflect period-specific names on the globe', () => {
      // 1900 snapshot
      const snap1900 = service.snapshot(1900, 'mid');
      if (snap1900.covered) {
        const china = snap1900.features.find((f) => f.properties.gw === 710);
        expect(china?.properties.name).toBe('Qing Empire');

        const ottoman = snap1900.features.find((f) => f.properties.gw === 640);
        expect(ottoman?.properties.name).toBe('Ottoman Empire');

        const persia = snap1900.features.find((f) => f.properties.gw === 630);
        expect(persia?.properties.name).toBe('Persia');

        const congo = snap1900.features.find((f) => f.properties.gw === 490);
        expect(congo?.properties.name).toBe('Congo Free State');
      }

      // 1975 snapshot
      const snap1975 = service.snapshot(1975, 'mid');
      if (snap1975.covered) {
        const zaire = snap1975.features.find((f) => f.properties.gw === 490);
        expect(zaire?.properties.name).toBe('Zaire');

        const upperVolta = snap1975.features.find((f) => f.properties.gw === 439);
        expect(upperVolta?.properties.name).toBe('Upper Volta');

        const turkey = snap1975.features.find((f) => f.properties.gw === 640);
        expect(turkey?.properties.name).toBe('Turkey');

        const iran = snap1975.features.find((f) => f.properties.gw === 630);
        expect(iran?.properties.name).toBe('Iran');
      }

      // 2000 snapshot
      const snap2000 = service.snapshot(2000, 'mid');
      if (snap2000.covered) {
        const drc = snap2000.features.find((f) => f.properties.gw === 490);
        expect(drc?.properties.name).toBe('Democratic Republic of the Congo');

        const burkina = snap2000.features.find((f) => f.properties.gw === 439);
        expect(burkina?.properties.name).toBe('Burkina Faso');
      }
    });
  });
});
