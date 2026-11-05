/** The guided "case files" on the Timeline page. Each jumps to a year and selects the entity. */
export interface HistoricalExample {
  id: string;
  label: string;
  gw: number;
  /** A year in which the entity exists under this name. */
  year: number;
  /** One line shown under the chip. */
  hint: string;
}

export const EXAMPLES: readonly HistoricalExample[] = [
  { id: 'ussr', label: 'Soviet Union', gw: 365, year: 1980, hint: 'One polygon until 1991' },
  { id: 'yugoslavia', label: 'Yugoslavia', gw: 345, year: 1985, hint: 'Gone by 2006' },
  { id: 'czechoslovakia', label: 'Czechoslovakia', gw: 315, year: 1980, hint: 'Split on 1 Jan 1993' },
  { id: 'east-germany', label: 'East Germany', gw: 265, year: 1980, hint: '1949–1990' },
  { id: 'west-germany', label: 'West Germany', gw: 260, year: 1980, hint: '1949–1990' },
  { id: 'ceylon', label: 'Ceylon', gw: 780, year: 1960, hint: 'Sri Lanka from 1972' },
  { id: 'burma', label: 'Burma', gw: 775, year: 1960, hint: 'Myanmar from 1989' },
  { id: 'rhodesia', label: 'Rhodesia', gw: 552, year: 1970, hint: 'Zimbabwe from 1980' },
];
