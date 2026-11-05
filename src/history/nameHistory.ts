import { SRC } from './sources';
import type { IsoDate, NameInfo, SourceRef } from './types';

/**
 * Period-appropriate names for the states in the eight case files.
 *
 * Why this exists: CShapes gives each state ONE label for all time ("Myanmar (Burma)",
 * "Sri Lanka (Ceylon)", "Zimbabwe (Rhodesia)", "Russia (Soviet Union)"). It cannot tell us what a
 * country was called in a given year, so those names are curated here, each with sources.
 *
 * Rules:
 *  - `historical`  the name was actually in use (checked against the cited sources).
 *  - `descriptive` our own wording for a situation with no state name (e.g. an occupation zone).
 *  - `precision`   how exactly `from` is known. Only `year`/`month` boundaries are flagged as approximate.
 *  - States not listed here fall back to the CShapes label, flagged as a "dataset label".
 */
export interface NamePeriod {
  gw: number;
  /** First day (inclusive). `''` = from the start of the state's coverage. */
  from: IsoDate | '';
  /** Last day (inclusive). `null` = still current. */
  to: IsoDate | null;
  name: string;
  official?: string;
  kind: 'historical' | 'descriptive';
  precision: 'day' | 'month' | 'year';
  note?: string;
  sources: SourceRef[];
}

const P = (p: NamePeriod): NamePeriod => p;

export const NAME_PERIODS: readonly NamePeriod[] = [
  // ---------- Russia / Soviet Union (GW 365) ----------
  P({ gw: 365, from: '', to: '1917-03-14', name: 'Russian Empire', kind: 'historical', precision: 'day',
    note: 'The Empire ended with the abdication of Nicholas II (15 March 1917, New Style).',
    sources: [SRC.russianRepublic] }),
  P({ gw: 365, from: '1917-03-15', to: '1917-09-13', name: 'Russia (Provisional Government)', kind: 'descriptive', precision: 'day',
    sources: [SRC.russianRepublic] }),
  P({ gw: 365, from: '1917-09-14', to: '1917-11-06', name: 'Russian Republic', kind: 'historical', precision: 'day',
    sources: [SRC.russianRepublic] }),
  P({ gw: 365, from: '1917-11-07', to: '1922-12-29', name: 'Soviet Russia', official: 'Russian Soviet Republic, later Russian SFSR', kind: 'descriptive', precision: 'day',
    note: 'Bolsheviks seized power on 7 November 1917; the Russian SFSR was formally established on 25 January 1918.',
    sources: [SRC.rsfsr] }),
  P({ gw: 365, from: '1922-12-30', to: '1991-12-25', name: 'Soviet Union', official: 'Union of Soviet Socialist Republics', kind: 'historical', precision: 'day',
    note: 'Formed 30 December 1922. Gorbachev resigned on 25 December 1991; the Union was dissolved on 26 December 1991. CShapes shrinks the polygon as republics left from 25 August 1991.',
    sources: [SRC.rsfsr] }),
  P({ gw: 365, from: '1991-12-26', to: null, name: 'Russia', official: 'Russian Federation', kind: 'historical', precision: 'day',
    note: 'The RSFSR was renamed the Russian Federation on 25 December 1991.',
    sources: [SRC.rsfsr] }),

  // ---------- Yugoslavia (GW 345) ----------
  P({ gw: 345, from: '', to: '1929-10-02', name: 'Kingdom of Serbs, Croats and Slovenes', kind: 'historical', precision: 'day',
    note: 'Formed 1 December 1918.', sources: [SRC.yugoslavia] }),
  P({ gw: 345, from: '1929-10-03', to: '1945-11-28', name: 'Yugoslavia', official: 'Kingdom of Yugoslavia', kind: 'historical', precision: 'year',
    note: 'Renamed in 1929. Sources differ on the exact day (Wikipedia gives 3 October; Britannica says only 1929).',
    sources: [SRC.yugoslavia, SRC.yugoslaviaBritannica] }),
  P({ gw: 345, from: '1945-11-29', to: '1963-04-06', name: 'Yugoslavia', official: "Federal People's Republic of Yugoslavia", kind: 'historical', precision: 'day',
    sources: [SRC.yugoslavia] }),
  P({ gw: 345, from: '1963-04-07', to: '1992-04-26', name: 'Yugoslavia', official: 'Socialist Federal Republic of Yugoslavia', kind: 'historical', precision: 'day',
    sources: [SRC.yugoslavia] }),
  P({ gw: 345, from: '1992-04-27', to: '2003-02-03', name: 'Yugoslavia', official: 'Federal Republic of Yugoslavia', kind: 'historical', precision: 'day',
    note: 'Serbia and Montenegro only, after Slovenia, Croatia, Macedonia and Bosnia left.',
    sources: [SRC.yugoslavia, SRC.serbiaMontenegro] }),
  P({ gw: 345, from: '2003-02-04', to: '2006-06-03', name: 'Serbia and Montenegro', official: 'State Union of Serbia and Montenegro', kind: 'historical', precision: 'day',
    note: 'Dissolved in June 2006 when Montenegro (3 June) and then Serbia (5 June) declared independence.',
    sources: [SRC.serbiaMontenegro] }),

  // ---------- Czechoslovakia (GW 315) ----------
  P({ gw: 315, from: '', to: '1992-12-31', name: 'Czechoslovakia', kind: 'historical', precision: 'day',
    note: 'Proclaimed 28 October 1918; dissolved 31 December 1992 / 1 January 1993 (sources give both). Its official name changed in 1960 and 1990.',
    sources: [SRC.czechoslovakia, SRC.czechDissolution] }),

  // ---------- Germany after 1945 (GW 260 West, GW 265 East) ----------
  P({ gw: 265, from: '', to: '1949-10-06', name: 'Soviet occupation zone of Germany', kind: 'descriptive', precision: 'day',
    note: 'Our label for the Soviet zone before the GDR was founded on 7 October 1949.',
    sources: [SRC.alliedGermany] }),
  P({ gw: 265, from: '1949-10-07', to: '1990-10-02', name: 'East Germany', official: 'German Democratic Republic', kind: 'historical', precision: 'day',
    note: 'Ceased to exist on 3 October 1990, when its five states joined the Federal Republic.',
    sources: [SRC.germanReunification, SRC.alliedGermany] }),
  P({ gw: 260, from: '', to: '1949-05-22', name: 'Western occupation zones of Germany', kind: 'descriptive', precision: 'day',
    note: 'Our label for the American, British and French zones before the Basic Law of 23 May 1949.',
    sources: [SRC.alliedGermany] }),
  P({ gw: 260, from: '1949-05-23', to: '1990-10-02', name: 'West Germany', official: 'Federal Republic of Germany', kind: 'historical', precision: 'day',
    sources: [SRC.germanReunification, SRC.alliedGermany] }),
  P({ gw: 260, from: '1990-10-03', to: null, name: 'Germany', official: 'Federal Republic of Germany', kind: 'historical', precision: 'day',
    note: 'Reunified on 3 October 1990. CShapes continues the West German code, so the polygon grows by the former GDR territory.',
    sources: [SRC.germanReunification] }),

  // ---------- Ceylon / Sri Lanka (GW 780) ----------
  P({ gw: 780, from: '', to: '1948-02-03', name: 'Ceylon', official: 'Colony of Ceylon (British Ceylon)', kind: 'historical', precision: 'day',
    sources: [SRC.dominionCeylon] }),
  P({ gw: 780, from: '1948-02-04', to: '1972-05-21', name: 'Ceylon', official: 'Dominion of Ceylon', kind: 'historical', precision: 'day',
    note: 'Independent from 4 February 1948.', sources: [SRC.dominionCeylon] }),
  P({ gw: 780, from: '1972-05-22', to: null, name: 'Sri Lanka', official: 'Republic of Sri Lanka', kind: 'historical', precision: 'day',
    note: 'Renamed by the 1972 Constitution, promulgated 22 May 1972.',
    sources: [SRC.ceylonConstitution, SRC.dominionCeylon] }),

  // ---------- Burma / Myanmar (GW 775) ----------
  P({ gw: 775, from: '', to: '1948-01-03', name: 'Burma', kind: 'historical', precision: 'day',
    note: 'CShapes draws Burma as a separate colony only from 1 April 1937; before that the area is part of British India.',
    sources: [SRC.myanmarNames] }),
  P({ gw: 775, from: '1948-01-04', to: '1973-12-31', name: 'Burma', official: 'Union of Burma', kind: 'historical', precision: 'day',
    note: 'Independent from 4 January 1948.', sources: [SRC.myanmarNames] }),
  P({ gw: 775, from: '1974-01-01', to: '1989-06-17', name: 'Burma', official: 'Socialist Republic of the Union of Burma', kind: 'historical', precision: 'year',
    note: 'Adopted in 1974 (the source gives no exact day).', sources: [SRC.myanmarNames] }),
  P({ gw: 775, from: '1989-06-18', to: '2010-12-31', name: 'Myanmar', official: 'Union of Myanmar', kind: 'historical', precision: 'day',
    note: 'English name changed by the Adaptation of Expressions Law, 18 June 1989. The Burmese-language name did not change.',
    sources: [SRC.myanmarNames] }),
  P({ gw: 775, from: '2011-01-01', to: null, name: 'Myanmar', official: 'Republic of the Union of Myanmar', kind: 'historical', precision: 'year',
    note: 'Official name from 2011 (the source gives no exact day).', sources: [SRC.myanmarNames] }),

  // ---------- Southern Rhodesia / Rhodesia / Zimbabwe (GW 552) ----------
  P({ gw: 552, from: '1889-01-01', to: '1897-12-31', name: 'British South Africa Company Territory', official: 'Mashonaland and Matabeleland (Zambesia)', kind: 'descriptive', precision: 'year',
    note: 'Administered by the British South Africa Company from 1889 under royal charter. The name Southern Rhodesia was formally adopted in 1898.',
    sources: [SRC.rhodesia] }),
  P({ gw: 552, from: '1898-01-01', to: '1964-10-23', name: 'Southern Rhodesia', kind: 'historical', precision: 'year',
    note: 'The name "Southern Rhodesia" dates from 1898 (year only) and was kept after company rule ended in 1923. The Federation of Rhodesia and Nyasaland replaced this polygon from August 1953 to the end of 1963.',
    sources: [SRC.rhodesia] }),
  P({ gw: 552, from: '1964-10-24', to: '1979-05-31', name: 'Rhodesia', kind: 'historical', precision: 'month',
    note: 'Adopted by the Salisbury government in October 1964, after Northern Rhodesia became Zambia; Britain refused to approve it. UDI followed on 11 November 1965, and the republic was declared on 2 March 1970. Neither was internationally recognised.',
    sources: [SRC.rhodesia] }),
  P({ gw: 552, from: '1979-06-01', to: '1979-12-11', name: 'Zimbabwe Rhodesia', kind: 'historical', precision: 'day',
    sources: [SRC.zimbabweRhodesia] }),
  P({ gw: 552, from: '1979-12-12', to: '1980-04-17', name: 'Rhodesia (British-supervised transition)', kind: 'descriptive', precision: 'day',
    note: 'A law of 11 December 1979 ended independence and Britain began a supervised transition on 12 December. Our label, not an official name.',
    sources: [SRC.zimbabweRhodesia] }),
  P({ gw: 552, from: '1980-04-18', to: null, name: 'Zimbabwe', official: 'Republic of Zimbabwe', kind: 'historical', precision: 'day',
    sources: [SRC.zimbabweRhodesia, SRC.rhodesia] }),

  // ---------- Northern Rhodesia / Zambia (GW 551) ----------
  P({ gw: 551, from: '', to: '1964-10-23', name: 'Northern Rhodesia', kind: 'historical', precision: 'year',
    note: 'Formed in 1911 from North-Western and North-Eastern Rhodesia. CShapes codes this state as independent from 22 January 1964; independence as Zambia came on 24 October 1964.',
    sources: [SRC.northernRhodesia] }),
  P({ gw: 551, from: '1964-10-24', to: null, name: 'Zambia', kind: 'historical', precision: 'day',
    sources: [SRC.northernRhodesia] }),
];

const byState = new Map<number, NamePeriod[]>();
for (const p of NAME_PERIODS) {
  const list = byState.get(p.gw) ?? [];
  list.push(p);
  byState.set(p.gw, list);
}

export function namePeriodsFor(gw: number): readonly NamePeriod[] {
  return byState.get(gw) ?? [];
}

export function findNamePeriod(gw: number, date: IsoDate): NamePeriod | null {
  for (const p of byState.get(gw) ?? []) {
    if ((p.from === '' || p.from <= date) && (p.to === null || date <= p.to)) return p;
  }
  return null;
}

/** Name to show for a state on a date; falls back to the CShapes label, flagged as such. */
export function resolveName(gw: number, date: IsoDate, datasetLabel: string): NameInfo {
  const p = findNamePeriod(gw, date);
  if (!p) {
    return {
      name: datasetLabel,
      official: null,
      provenance: 'dataset',
      approximate: false,
      note: 'No period-specific name is recorded for this state and date, so the CShapes label is shown. It may combine several historical names or use a present-day one.',
      sources: [SRC.cshapesPage],
    };
  }
  return {
    name: p.name,
    official: p.official ?? null,
    provenance: p.kind === 'historical' ? 'verified' : 'descriptive',
    approximate: p.precision !== 'day' && p.from !== '',
    note: p.note ?? null,
    sources: p.sources,
  };
}

/** Every name a state has had in the table, used by search. */
export function allNamesFor(gw: number): string[] {
  const names = new Set<string>();
  for (const p of byState.get(gw) ?? []) {
    names.add(p.name);
    if (p.official) names.add(p.official);
  }
  return [...names];
}
