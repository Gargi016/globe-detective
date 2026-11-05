import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DATASET_NOTES } from '../datasetNotes';
import { createHistoryService } from '../historyService';

describe('Tier 1: Territorial Accuracy Dataset Notes', () => {
  it('every note in DATASET_NOTES has valid date bounds, text, and sources', () => {
    expect(DATASET_NOTES.length).toBeGreaterThan(15);
    for (const note of DATASET_NOTES) {
      expect(note.id).toBeTruthy();
      expect(note.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.from <= note.to).toBe(true);
      expect(note.text.length).toBeGreaterThan(20);
      expect(note.provenance).toMatch(/^(verified|dataset)$/);
      for (const src of note.sources) {
        expect(src.label).toBeTruthy();
        expect(src.url).toMatch(/^https?:\/\//);
      }
    }
  });

  describe('Kashmir Territorial Context (GW 750 India & GW 770 Pakistan)', () => {
    it('provides contextual notes for India (750) and Pakistan (770) from 1949 onwards', () => {
      const indiaNotes = DATASET_NOTES.filter(
        (n) => n.gw === 750 && n.from <= '1975-01-01' && '1975-01-01' <= n.to && n.id === 'cs-kashmir-in'
      );
      expect(indiaNotes.length).toBe(1);
      expect(indiaNotes[0].text).toContain('Line of Control');
      expect(indiaNotes[0].text).toContain('de facto administrative control');
      expect(indiaNotes[0].sources.some((s) => s.label.includes('UNMOGIP'))).toBe(true);

      const pakNotes = DATASET_NOTES.filter(
        (n) => n.gw === 770 && n.from <= '1975-01-01' && '1975-01-01' <= n.to && n.id === 'cs-kashmir-pk'
      );
      expect(pakNotes.length).toBe(1);
      expect(pakNotes[0].text).toContain('Azad Kashmir and Gilgit-Baltistan');
      expect(pakNotes[0].text).toContain('UN-supervised plebiscite');
    });

    it('does not apply Kashmir notes prior to 1949', () => {
      const notes1947 = DATASET_NOTES.filter(
        (n) => (n.gw === 750 || n.gw === 770) && n.id.startsWith('cs-kashmir') && n.from <= '1947-08-15' && '1947-08-15' <= n.to
      );
      expect(notes1947.length).toBe(0);
    });
  });

  describe('Taiwan Context (GW 713 ROC & GW 710 PRC)', () => {
    it('explains de facto administration vs One China claim and UN Resolution 2758', () => {
      const taiwanNotes = DATASET_NOTES.filter(
        (n) => n.gw === 713 && n.from <= '1980-01-01' && '1980-01-01' <= n.to && n.id === 'cs-taiwan-roc'
      );
      expect(taiwanNotes.length).toBe(1);
      expect(taiwanNotes[0].text).toContain('One China');
      expect(taiwanNotes[0].text).toContain('Resolution 2758');
      expect(taiwanNotes[0].text).toContain('de facto administrative reality');

      const prcNotes = DATASET_NOTES.filter(
        (n) => n.gw === 710 && n.from <= '1980-01-01' && '1980-01-01' <= n.to && n.id === 'cs-taiwan-prc'
      );
      expect(prcNotes.length).toBe(1);
      expect(prcNotes[0].text).toContain('GW 713');
    });

    it('does not apply post-1949 Taiwan notes to the 1920 snapshot', () => {
      const oldNotes = DATASET_NOTES.filter(
        (n) => (n.gw === 713 || n.gw === 710) && n.id.startsWith('cs-taiwan') && n.from <= '1920-01-01' && '1920-01-01' <= n.to
      );
      expect(oldNotes.length).toBe(0);
    });
  });

  describe('Crimea Annexation Context (GW 365 Russia & GW 369 Ukraine)', () => {
    it('explains de facto transfer vs UN General Assembly Resolution 68/262', () => {
      const ruNotes = DATASET_NOTES.filter(
        (n) => n.gw === 365 && n.from <= '2015-01-01' && '2015-01-01' <= n.to && n.id === 'cs-crimea-ru'
      );
      expect(ruNotes.length).toBe(1);
      expect(ruNotes[0].text).toContain('68/262');
      expect(ruNotes[0].text).toContain('effective territorial control here, not international legality');

      const uaNotes = DATASET_NOTES.filter(
        (n) => n.gw === 369 && n.from <= '2015-01-01' && '2015-01-01' <= n.to && n.id === 'cs-crimea-ua'
      );
      expect(uaNotes.length).toBe(1);
      expect(uaNotes[0].text).toContain('integral part of sovereign Ukraine');
    });

    it('does not apply Crimea notes before 18 March 2014', () => {
      const earlyNotes = DATASET_NOTES.filter(
        (n) => (n.gw === 365 || n.gw === 369) && n.id.startsWith('cs-crimea') && n.from <= '2013-01-01' && '2013-01-01' <= n.to
      );
      expect(earlyNotes.length).toBe(0);
    });
  });

  describe('Palestine / Occupied Territories Context (GW 666 Israel)', () => {
    it('notes CShapes aggregation of West Bank, Gaza, and Golan and cites UNSC 242', () => {
      const palNotes = DATASET_NOTES.filter(
        (n) => n.gw === 666 && n.from <= '1985-01-01' && '1985-01-01' <= n.to && n.id === 'cs-palestine-il'
      );
      expect(palNotes.length).toBe(1);
      expect(palNotes[0].text).toContain('West Bank, Gaza Strip');
      expect(palNotes[0].text).toContain('Resolutions 242');
      expect(palNotes[0].text).toContain('Non-Member Observer State');
    });

    it('does not apply 1967 occupied territories note to 1955', () => {
      const pre67Notes = DATASET_NOTES.filter(
        (n) => n.gw === 666 && n.id === 'cs-palestine-il' && n.from <= '1955-01-01' && '1955-01-01' <= n.to
      );
      expect(pre67Notes.length).toBe(0);
    });
  });

  describe('Western Sahara Context (GW 600 Morocco)', () => {
    it('notes CShapes inclusion of Western Sahara into Morocco vs UN non-self-governing status', () => {
      const wsNotes = DATASET_NOTES.filter(
        (n) => n.gw === 600 && n.from <= '2000-01-01' && '2000-01-01' <= n.to && n.id === 'cs-western-sahara-ma'
      );
      expect(wsNotes.length).toBe(1);
      expect(wsNotes[0].text).toContain('Non-Self-Governing Territory');
      expect(wsNotes[0].text).toContain('MINURSO');
      expect(wsNotes[0].text).toContain('Polisario Front');
    });

    it('does not apply Western Sahara note before Madrid Accords in 1975', () => {
      const pre75Notes = DATASET_NOTES.filter(
        (n) => n.gw === 600 && n.id === 'cs-western-sahara-ma' && n.from <= '1970-01-01' && '1970-01-01' <= n.to
      );
      expect(pre75Notes.length).toBe(0);
    });
  });

  describe('Cyprus Partition Context (GW 352 Cyprus)', () => {
    it('notes CShapes undivided polygon vs 1974 de facto partition and UNSC 541', () => {
      const cyNotes = DATASET_NOTES.filter(
        (n) => n.gw === 352 && n.from <= '1995-01-01' && '1995-01-01' <= n.to && n.id === 'cs-cyprus'
      );
      expect(cyNotes.length).toBe(1);
      expect(cyNotes[0].text).toContain('Turkish Republic of Northern Cyprus');
      expect(cyNotes[0].text).toContain('541');
      expect(cyNotes[0].text).toContain('Green Line');
      expect(cyNotes[0].text).toContain('Sovereign Base Areas');
    });

    it('does not apply 1974 partition note to 1965', () => {
      const pre74Notes = DATASET_NOTES.filter(
        (n) => n.gw === 352 && n.id === 'cs-cyprus' && n.from <= '1965-01-01' && '1965-01-01' <= n.to
      );
      expect(pre74Notes.length).toBe(0);
    });
  });

  describe('HistoryService Integration & Snapshot Verification', () => {
    const topoPath = path.resolve(__dirname, '../../../public/data/cshapes/cshapes-2.0-gw.simplified.topojson');
    const topo = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
    const service = createHistoryService(topo);

    it('service.notesFor correctly surfaces active notes across historical dates', () => {
      // 1950: Kashmir notes active for India and Pakistan
      expect(service.notesFor(750, '1950-06-30').some((n) => n.id === 'cs-kashmir-in')).toBe(true);
      expect(service.notesFor(770, '1950-06-30').some((n) => n.id === 'cs-kashmir-pk')).toBe(true);

      // 1950: Taiwan notes active
      expect(service.notesFor(713, '1950-06-30').some((n) => n.id === 'cs-taiwan-roc')).toBe(true);
      expect(service.notesFor(710, '1950-06-30').some((n) => n.id === 'cs-taiwan-prc')).toBe(true);

      // 1968: Palestine note active for Israel
      expect(service.notesFor(666, '1968-06-30').some((n) => n.id === 'cs-palestine-il')).toBe(true);

      // 1980: Western Sahara and Cyprus notes active
      expect(service.notesFor(600, '1980-06-30').some((n) => n.id === 'cs-western-sahara-ma')).toBe(true);
      expect(service.notesFor(352, '1980-06-30').some((n) => n.id === 'cs-cyprus')).toBe(true);

      // 2015: Crimea note active for Russia and Ukraine
      expect(service.notesFor(365, '2015-06-30').some((n) => n.id === 'cs-crimea-ru')).toBe(true);
      expect(service.notesFor(369, '2015-06-30').some((n) => n.id === 'cs-crimea-ua')).toBe(true);
    });

    it('verifies historical snapshots across transition boundaries', () => {
      // 1948 mid snapshot (before 1949 LoC)
      const snap1948 = service.snapshot(1948, 'mid');
      if (snap1948.covered) {
        expect(service.notesFor(750, snap1948.date).some((n) => n.id === 'cs-kashmir-in')).toBe(false);
      }

      // 1950 mid snapshot (after 1949 ceasefire)
      const snap1950 = service.snapshot(1950, 'mid');
      if (snap1950.covered) {
        expect(service.notesFor(750, snap1950.date).some((n) => n.id === 'cs-kashmir-in')).toBe(true);
        expect(service.notesFor(713, snap1950.date).some((n) => n.id === 'cs-taiwan-roc')).toBe(true);
      }

      // 2013 vs 2015 snapshots for Crimea
      const snap2013 = service.snapshot(2013, 'mid');
      if (snap2013.covered) {
        expect(service.notesFor(365, snap2013.date).some((n) => n.id === 'cs-crimea-ru')).toBe(false);
      }

      const snap2015 = service.snapshot(2015, 'mid');
      if (snap2015.covered) {
        expect(service.notesFor(365, snap2015.date).some((n) => n.id === 'cs-crimea-ru')).toBe(true);
        expect(service.notesFor(369, snap2015.date).some((n) => n.id === 'cs-crimea-ua')).toBe(true);
      }
    });
  });
});
