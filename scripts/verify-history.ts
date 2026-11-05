// Verifies the historical data service against the real dataset.
//   npm run verify:history
//
// Every statement about how CShapes codes things (DATASET_NOTES) and every name period is checked
// against the data here, so those claims are verified, not just recalled.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASET_NOTES } from '../src/history/datasetNotes';
import { EXAMPLES } from '../src/history/examples';
import { createHistoryService } from '../src/history/historyService';
import { NAME_PERIODS } from '../src/history/nameHistory';

const file = join(import.meta.dirname, '..', 'public', 'data', 'cshapes', 'cshapes-2.0-gw.simplified.topojson');
const topology = JSON.parse(readFileSync(file, 'utf8'));
const svc = createHistoryService(topology);

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const names = (year: number, anchor: 'start' | 'mid' | 'end' = 'start') => {
  const s = svc.snapshot(year, anchor);
  return new Map(s.features.map((f) => [f.properties.gw, f.properties]));
};

// --- Dataset -----------------------------------------------------------------------------
check('710 periods loaded', svc.periodCount === 710, String(svc.periodCount));

// --- Sourced name table is consistent with the dataset -----------------------------------
const nameGws = [...new Set(NAME_PERIODS.map((p) => p.gw))];
for (const gw of nameGws) {
  check(`names: gw ${gw} exists in CShapes`, svc.summary(gw) !== null);
  const rows = NAME_PERIODS.filter((p) => p.gw === gw);
  rows.forEach((r, i) => {
    check(`names gw ${gw} #${i}: has a source`, r.sources.length > 0);
    check(`names gw ${gw} #${i}: from <= to`, r.from === '' || r.to === null || r.from <= r.to, `${r.from}..${r.to}`);
    if (i > 0) {
      const prev = rows[i - 1];
      check(`names gw ${gw}: #${i - 1}/#${i} contiguous, no overlap`, prev.to !== null && r.from !== '' && prev.to < r.from, `${prev.to} vs ${r.from}`);
    } else {
      check(`names gw ${gw}: first period starts at coverage start`, r.from === '' || r.from >= '1886-01-01');
    }
  });
  // Every polygon start should fall in some name period, otherwise the app shows the CShapes label.
  const uncovered = svc.periodsOf(gw).filter((p) => !rows.some((r) => (r.from === '' || r.from <= p.start) && (r.to === null || p.start <= r.to)));
  if (uncovered.length) console.log(`  note: gw ${gw} has ${uncovered.length} polygon(s) outside its name periods (CShapes label shown), first start ${uncovered[0].start}`);
}
for (const ex of EXAMPLES) {
  check(`example ${ex.id}: entity exists in ${ex.year}`, names(ex.year).has(ex.gw));
}
for (const n of DATASET_NOTES) {
  check(`note ${n.id}: gw ${n.gw} exists (or 0)`, n.gw === 0 || svc.summary(n.gw) !== null);
  check(`note ${n.id}: from <= to`, n.from <= n.to);
  if (n.provenance === 'verified') check(`note ${n.id}: verified notes cite sources`, n.sources.length > 0);
}

// --- Coverage: no fabrication outside the dataset ---------------------------------------
for (const [year, reason] of [[1885, 'before'], [1700, 'before'], [2020, 'after'], [2026, 'after'], [1965.5, 'invalid']] as const) {
  const s = svc.snapshot(year);
  check(`year ${year}: not covered`, !s.covered && s.features.length === 0);
  check(`year ${year}: gap reason ${reason}`, svc.coverageGap(year)?.reason === reason);
}
check('1886 covered', svc.snapshot(1886).covered);
check('2019 covered', svc.snapshot(2019, 'end').covered);
check('2019-12-31 is last date', svc.dateFor(2019, 'end') === svc.meta.coverageEnd);

// --- Every covered year renders real, non-empty geometry ---------------------------------
let minCount = Infinity;
let maxCount = 0;
for (let y = svc.meta.firstYear; y <= svc.meta.lastYear; y++) {
  for (const a of ['start', 'mid', 'end'] as const) {
    const s = svc.snapshot(y, a);
    if (!s.covered) {
      check(`${y}/${a} covered`, false);
      continue;
    }
    const bad = s.features.filter((f) => !f.geometry || f.geometry.coordinates.length === 0).length;
    check(`${y}/${a}: ${s.features.length} polygons, none empty`, s.features.length > 0 && bad === 0);
    const keys = new Set(s.features.map((f) => f.properties.key));
    check(`${y}/${a}: one polygon per entity`, keys.size === s.features.length);
    if (a === 'start') {
      minCount = Math.min(minCount, s.features.length);
      maxCount = Math.max(maxCount, s.features.length);
    }
  }
}
console.log(`  polygons per 1 Jan snapshot: min ${minCount}, max ${maxCount}`);

// --- The eight case files ----------------------------------------------------------------
const expectName = (label: string, year: number, gw: number, name: string, anchor: 'start' | 'mid' | 'end' = 'start') => {
  const p = names(year, anchor).get(gw);
  check(`${label}: ${year}/${anchor} gw ${gw} is "${name}"`, p?.name === name, `got ${p?.name ?? 'absent'}`);
};
const expectAbsent = (label: string, year: number, gw: number, anchor: 'start' | 'mid' | 'end' = 'start') => {
  check(`${label}: ${year}/${anchor} gw ${gw} absent`, !names(year, anchor).has(gw));
};

// Soviet Union
expectName('USSR', 1980, 365, 'Soviet Union');
expectName('USSR', 1922, 365, 'Soviet Russia'); // 1 Jan 1922: before the USSR was formed on 30 Dec
expectName('USSR', 1923, 365, 'Soviet Union');
expectName('USSR', 1913, 365, 'Russian Empire');
expectName('USSR', 1992, 365, 'Russia');
expectName('USSR', 1991, 365, 'Soviet Union'); // 1 Jan 1991
expectName('USSR', 1991, 365, 'Russia', 'end');
check('USSR 1990 has no separate Ukraine/Baltics', !names(1990).has(369) && !names(1990).has(366));
check('Ukraine exists by 1992', names(1992).has(369));

// Yugoslavia
expectName('Yugoslavia', 1925, 345, 'Kingdom of Serbs, Croats and Slovenes');
expectName('Yugoslavia', 1935, 345, 'Yugoslavia');
expectName('Yugoslavia', 1985, 345, 'Yugoslavia');
expectName('Yugoslavia', 2005, 345, 'Serbia and Montenegro');
expectAbsent('Yugoslavia', 2007, 345);
check('Slovenia exists 1993', names(1993).has(349));

// Czechoslovakia
expectName('Czechoslovakia', 1980, 315, 'Czechoslovakia');
expectName('Czechoslovakia', 1992, 315, 'Czechoslovakia');
expectAbsent('Czechoslovakia', 1993, 315);
check('Czech Republic + Slovakia exist 1993', names(1993).has(316) && names(1993).has(317));

// Germany
expectName('West Germany', 1980, 260, 'West Germany');
expectName('East Germany', 1980, 265, 'East Germany');
expectName('Germany', 1991, 260, 'Germany');
expectAbsent('East Germany', 1991, 265);
expectName('West Germany occupation', 1946, 260, 'Western occupation zones of Germany');
expectName('East Germany occupation', 1946, 265, 'Soviet occupation zone of Germany');
check('unlisted state falls back to CShapes label, flagged as dataset', names(1900).get(255)?.nameInfo.provenance === 'dataset' && names(1900).get(255)?.name === 'Germany (Prussia)');
check('listed state is flagged verified', names(1980).get(365)?.nameInfo.provenance === 'verified');
check('descriptive names flagged as ours', names(1946).get(260)?.nameInfo.provenance === 'descriptive');
check('verified names carry sources', (names(1980).get(365)?.nameInfo.sources.length ?? 0) > 0);
check('East Germany 1946 status occupied', names(1946).get(265)?.status === 'occupied');
check('East Germany 1980 independent', names(1980).get(265)?.status === 'independent');

// Ceylon
expectName('Ceylon', 1940, 780, 'Ceylon');
check('Ceylon 1940 is a colony of the UK', names(1940).get(780)?.status === 'colony' && names(1940).get(780)?.ownerName === 'United Kingdom', `${names(1940).get(780)?.status} ${names(1940).get(780)?.ownerName}`);
expectName('Ceylon', 1960, 780, 'Ceylon');
check('Ceylon 1960 independent', names(1960).get(780)?.status === 'independent');
expectName('Ceylon', 1972, 780, 'Ceylon'); // 1 Jan 1972, before the 22 May renaming
expectName('Sri Lanka', 1972, 780, 'Sri Lanka', 'end');
expectName('Sri Lanka', 1990, 780, 'Sri Lanka');

// Burma
expectName('Burma', 1960, 775, 'Burma');
expectName('Burma', 1989, 775, 'Burma');
expectName('Myanmar', 1989, 775, 'Myanmar', 'end');
expectName('Myanmar', 2000, 775, 'Myanmar');
expectAbsent('Burma pre-separation', 1930, 775);
check('Burma 1940 colony', names(1940).get(775)?.status === 'colony');

// Rhodesia
expectName('Rhodesia BSAC', 1895, 552, 'British South Africa Company Territory');
expectName('Rhodesia', 1950, 552, 'Southern Rhodesia');
expectName('Federation', 1960, 550, 'Federation of Rhodesia and Nyasaland');
expectAbsent('Rhodesia during federation', 1960, 552);
expectName('Rhodesia', 1970, 552, 'Rhodesia');
expectName('Zimbabwe Rhodesia', 1979, 552, 'Zimbabwe Rhodesia', 'mid');
expectName('Zimbabwe', 1981, 552, 'Zimbabwe');
expectName('Rhodesia transition', 1979, 552, 'Rhodesia (British-supervised transition)', 'end');
expectAbsent('Zambia during federation', 1960, 551);
expectName('Northern Rhodesia', 1950, 551, 'Northern Rhodesia');
expectName('Zambia', 1965, 551, 'Zambia');
check('Rhodesia 1970 independent (as coded by CShapes)', names(1970).get(552)?.status === 'independent');
check('Rhodesia 1964 colony', names(1964, 'end').get(552)?.status === 'colony');

// --- Dataset notes: every factual claim checked against the data --------------------------
const only = (gw: number) => svc.periodsOf(gw);
check('cs-ww2: Czechoslovakia polygon 1938-11-02..1945-05-07 (one polygon through the war)', only(315).some((p) => p.start === '1938-11-02' && p.end === '1945-05-07'));
check('cs-ww2: Slovakia first appears 1993-01-01', only(317)[0]?.start === '1993-01-01');
check('yu-ww2: one continuous Yugoslav polygon 1920-06-04..1991-11-19, independent', only(345).some((p) => p.start === '1920-06-04' && p.end === '1991-11-19' && p.status === 'independent'));
check('in-burma: Burma first polygon starts 1937-04-01 as a colony', only(775)[0]?.start === '1937-04-01' && only(775)[0]?.status === 'colony');
check('rh-udi: Rhodesia independent from 1965-11-11', only(552).some((p) => p.status === 'independent' && p.start === '1965-11-11'));
check('zm-1964: Zambia coded independent from 1964-01-22', only(551).some((p) => p.status === 'independent' && p.start === '1964-01-22'));
check('de-1949: West Germany occupied to 1949-09-20, independent from 1949-09-21', only(260).some((p) => p.status === 'occupied' && p.end === '1949-09-20') && only(260).some((p) => p.status === 'independent' && p.start === '1949-09-21'));
check('de-gdr-1949: GDR occupied to 1949-10-04, independent from 1949-10-05', only(265).some((p) => p.status === 'occupied' && p.end === '1949-10-04') && only(265).some((p) => p.status === 'independent' && p.start === '1949-10-05'));
const republicCodes = [359, 366, 367, 368, 369, 370, 371, 372, 373, 701, 702, 703, 704, 705];
const sovietRepublicPolys = republicCodes.flatMap((gw) => only(gw)).filter((p) => p.start >= '1945-05-08' && p.start <= '1991-08-24');
check('ru-republics: no republic polygons start 1945..Aug 1991', sovietRepublicPolys.length === 0, `${sovietRepublicPolys.length} found`);
check('rh-federation: Southern Rhodesia ends 1953-07-31 and resumes 1964-01-22', only(552).some((p) => p.end === '1953-07-31') && only(552).some((p) => p.start === '1964-01-22'));
check('rh-federation: Federation polygon 1953-08-01..1964-01-21', only(550).some((p) => p.start === '1953-08-01' && p.end === '1964-01-21'));
const allUndefined = [...new Set(topology.objects.cshapes_2_gw.geometries.map((g: { properties: { bdef: number; end: string } }) => g.properties).filter((p: { bdef: number }) => p.bdef === 0).map((p: { end: string }) => p.end))] as string[];
check('cs-borders-undefined: latest undefined-boundary row ends 1990-02-22', allUndefined.sort().at(-1) === '1990-02-22', String(allUndefined.sort().at(-1)));

// --- Derived changes ---------------------------------------------------------------------
const has = (year: number, kind: string, gw: number) => svc.changesInYear(year).some((c) => c.kind === kind && c.gw === gw);
check('1990: East Germany ends', has(1990, 'ends', 265));
check('1990: West Germany polygon revised (reunification)', has(1990, 'boundary', 260));
check('1992: Czechoslovakia ends', has(1992, 'ends', 315));
check('1993: Czech Republic appears', has(1993, 'appears', 316));
check('1948: Burma colony -> independent', has(1948, 'status', 775));
check('1948: Ceylon colony -> independent', has(1948, 'status', 780));
check('1949: West Germany occupied -> independent', has(1949, 'status', 260));
check('1965: Rhodesia colony -> independent', has(1965, 'status', 552));
check('1964: Rhodesia reappears after the Federation', has(1964, 'reappears', 552));
check('1964: Federation ends', has(1964, 'ends', 550));
check('2006: Yugoslavia (Serbia and Montenegro) ends', has(2006, 'ends', 345));
check('1886: no "appears" (dataset start is not an event)', svc.changesInYear(1886).every((c) => c.kind !== 'appears'));
check('2019: no "ends" (dataset end is not an event)', svc.changesInYear(2019).every((c) => c.kind !== 'ends'));
check('1850: no changes (outside coverage)', svc.changesInYear(1850).length === 0);
check('1972: Ceylon renamed Sri Lanka (curated name change)', svc.nameChangesInYear(1972).some((c) => c.gw === 780 && c.from === 'Ceylon' && c.to === 'Sri Lanka'));
check('1989: Burma renamed Myanmar', svc.nameChangesInYear(1989).some((c) => c.gw === 775 && c.to === 'Myanmar'));
check('1980: Rhodesia renamed Zimbabwe', svc.nameChangesInYear(1980).some((c) => c.gw === 552 && c.to === 'Zimbabwe'));
check('name changes carry sources', svc.nameChangesInYear(1972).every((c) => c.sources.length > 0));
check('no name change listed for same-name periods (Yugoslavia 1963)', svc.nameChangesInYear(1963).every((c) => c.gw !== 345));

// --- Search ------------------------------------------------------------------------------
const found = (q: string, gw: number) => svc.search(q).some((s) => s.gw === gw);
check('search "burma" -> 775', found('burma', 775));
check('search "myanmar" -> 775', found('myanmar', 775));
check('search "ceylon" -> 780', found('ceylon', 780));
check('search "rhodesia" -> 552 and 550', found('rhodesia', 552) && found('rhodesia', 550));
check('search "soviet" -> 365', found('soviet', 365));
check('search "east germany" -> 265', found('east germany', 265));
check('search "yugoslavia" -> 345', found('yugoslavia', 345));
check('search "zzzz" -> nothing', svc.search('zzzz').length === 0);

// --- Report ------------------------------------------------------------------------------
if (failures.length) {
  console.error(`\n${failures.length} FAILED, ${passed} passed:`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
