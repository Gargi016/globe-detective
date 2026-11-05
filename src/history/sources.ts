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
  unMogip: {
    label: 'UN Military Observer Group in India and Pakistan (UNMOGIP)',
    url: 'https://peacekeeping.un.org/en/mission/unmogip',
  },
  simlaAgreement: {
    label: 'Simla Agreement on Bilateral Relations (1972)',
    url: 'https://peacemaker.un.org/in-pk-simlaagreement72',
  },
  unRes2758: {
    label: 'UN General Assembly Resolution 2758 (XXVI) (1971)',
    url: 'https://digitallibrary.un.org/record/192070',
  },
  unRes68262: {
    label: 'UN General Assembly Resolution 68/262: Territorial integrity of Ukraine (2014)',
    url: 'https://digitallibrary.un.org/record/767965',
  },
  unRes242: {
    label: 'UN Security Council Resolution 242 (1967)',
    url: 'https://digitallibrary.un.org/record/90297',
  },
  unRes6719: {
    label: 'UN General Assembly Resolution 67/19: Status of Palestine in the UN (2012)',
    url: 'https://digitallibrary.un.org/record/739947',
  },
  unWesternSahara: {
    label: 'UN Non-Self-Governing Territories / MINURSO',
    url: 'https://www.un.org/dppa/decolonization/en/nsgt/western-sahara',
  },
  unRes541: {
    label: 'UN Security Council Resolution 541 (1983)',
    url: 'https://digitallibrary.un.org/record/53544',
  },
  qingDynasty: {
    label: 'Qing dynasty (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Qing_dynasty',
  },
  republicOfChina: {
    label: 'Republic of China (1912–1949) (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Republic_of_China_(1912%E2%80%931949)',
  },
  peoplesRepublicOfChina: {
    label: "People's Republic of China (Wikipedia)",
    url: 'https://en.wikipedia.org/wiki/China',
  },
  ottomanEmpire: {
    label: 'Ottoman Empire (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Ottoman_Empire',
  },
  republicOfTurkey: {
    label: 'Turkey (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Turkey',
  },
  persiaIran: {
    label: 'Name of Iran (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Name_of_Iran',
  },
  iranHistory: {
    label: 'History of Iran (Encyclopædia Britannica)',
    url: 'https://www.britannica.com/place/Iran',
  },
  congoFreeState: {
    label: 'Congo Free State (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Congo_Free_State',
  },
  belgianCongo: {
    label: 'Belgian Congo (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Belgian_Congo',
  },
  congoLeopoldville: {
    label: 'Republic of the Congo (Léopoldville) (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Republic_of_the_Congo_(L%C3%A9opoldville)',
  },
  zaireHistory: {
    label: 'Zaire (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Zaire',
  },
  drcHistory: {
    label: 'Democratic Republic of the Congo (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Democratic_Republic_of_the_Congo',
  },
  upperVolta: {
    label: 'Republic of Upper Volta (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Republic_of_Upper_Volta',
  },
  burkinaFaso: {
    label: 'Burkina Faso (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Burkina_Faso',
  },
} as const satisfies Record<string, SourceRef>;
