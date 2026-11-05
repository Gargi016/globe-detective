import type { CountryFeature } from '../types/geo';

/**
 * Expands the abbreviated labels used by the Natural Earth / world-atlas dataset.
 * These are modern, present-day names.
 */
const FULL_NAMES: Record<string, string> = {
  'W. Sahara': 'Western Sahara',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Falkland Is.': 'Falkland Islands',
  'Fr. S. Antarctic Lands': 'French Southern and Antarctic Lands',
  'Central African Rep.': 'Central African Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Solomon Is.': 'Solomon Islands',
  'N. Cyprus': 'Northern Cyprus',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'S. Sudan': 'South Sudan',
  eSwatini: 'Eswatini',
};

/** Extra search terms (alternative and former names) keyed by the dataset name. */
const ALIASES: Record<string, string[]> = {
  'United States of America': ['USA', 'US', 'United States', 'America'],
  'United Kingdom': ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales'],
  Russia: ['Russian Federation', 'USSR', 'Soviet Union'],
  Czechia: ['Czech Republic'],
  eSwatini: ['Swaziland'],
  Myanmar: ['Burma'],
  'Timor-Leste': ['East Timor'],
  "Côte d'Ivoire": ['Ivory Coast', 'Cote d Ivoire'],
  'Dem. Rep. Congo': ['DRC', 'Congo-Kinshasa', 'Zaire'],
  'Dominican Rep.': ['Dominican Republic'],
  'Bosnia and Herz.': ['Bosnia', 'Herzegovina'],
  'N. Cyprus': ['Northern Cyprus'],
  'S. Sudan': ['South Sudan'],
  'W. Sahara': ['Western Sahara'],
  'Eq. Guinea': ['Equatorial Guinea'],
  'Solomon Is.': ['Solomon Islands'],
  'Falkland Is.': ['Falkland Islands', 'Malvinas'],
  'Fr. S. Antarctic Lands': ['French Southern Territories', 'Kerguelen'],
  'Central African Rep.': ['Central African Republic'],
  Macedonia: ['North Macedonia'],
  Turkey: ['Türkiye', 'Turkiye'],
  'South Korea': ['Korea', 'Republic of Korea'],
  'North Korea': ['Korea', 'DPRK'],
  Palestine: ['West Bank', 'Gaza'],
};

export function displayName(feature: CountryFeature): string {
  const raw = feature.properties?.name ?? 'Unknown territory';
  return FULL_NAMES[raw] ?? raw;
}

export function searchTerms(feature: CountryFeature): string[] {
  const raw = feature.properties?.name ?? '';
  return [displayName(feature), raw, ...(ALIASES[raw] ?? [])];
}

/** Lower-case, accent-free form used for matching search queries. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
