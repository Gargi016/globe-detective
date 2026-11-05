import type { SourceRef } from './types';

/**
 * Every external source used by the curated tables, in one place so that a URL is written once.
 * All of these were opened and read while building this phase; dates quoted in the tables come from them.
 */
export const SRC = {
  cshapesPage: { label: 'CShapes project page (ETH Zürich)', url: 'https://icr.ethz.ch/data/cshapes/' },
  cshapesPaper: {
    label: 'Schvitz et al. (2022), Journal of Conflict Resolution',
    url: 'https://doi.org/10.1177/00220027211013563',
  },
  rsfsr: {
    label: 'Russian Soviet Federative Socialist Republic (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Russian_Soviet_Federative_Socialist_Republic',
  },
  russianRepublic: {
    label: 'Russian Republic (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Russian_Republic',
  },
  yugoslavia: { label: 'Yugoslavia (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Yugoslavia' },
  yugoslaviaBritannica: {
    label: 'Yugoslavia (Encyclopædia Britannica)',
    url: 'https://www.britannica.com/EBchecked/topic/654783',
  },
  serbiaMontenegro: {
    label: 'Serbia and Montenegro (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Serbia_and_Montenegro',
  },
  czechoslovakia: { label: 'Czechoslovakia (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Czechoslovakia' },
  czechDissolution: {
    label: 'Dissolution of Czechoslovakia (New World Encyclopedia)',
    url: 'https://www.newworldencyclopedia.org/entry/Dissolution_of_Czechoslovakia',
  },
  germanReunification: {
    label: 'German reunification (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/German_reunification',
  },
  alliedGermany: {
    label: 'Allied-occupied Germany (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Allied-occupied_Germany',
  },
  myanmarNames: { label: 'Names of Myanmar (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Names_of_Myanmar' },
  dominionCeylon: { label: 'Dominion of Ceylon (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Dominion_of_Ceylon' },
  ceylonConstitution: {
    label: 'Sri Lankan Constitution of 1972 (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Sri_Lankan_Constitution_of_1972',
  },
  rhodesia: { label: 'Rhodesia (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Rhodesia' },
  zimbabweRhodesia: {
    label: 'Zimbabwe Rhodesia (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Zimbabwe_Rhodesia',
  },
  northernRhodesia: {
    label: 'Northern Rhodesia (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Northern_Rhodesia',
  },
} as const satisfies Record<string, SourceRef>;
