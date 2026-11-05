/**
 * Build-time configuration. All values are optional; see .env.example.
 * The Earth imagery is served from this site (/img). Set these variables to use other images or a CDN.
 */
const env = import.meta.env as Record<string, string | undefined>;

const clean = (v: string | undefined, fallback: string) => (v && v.trim() !== '' ? v.trim() : fallback);
const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const EARTH_TEXTURE_URL = clean(env.VITE_EARTH_TEXTURE_URL, `${base}img/earth-blue-marble.jpg`);
export const EARTH_BUMP_URL = clean(env.VITE_EARTH_BUMP_URL, `${base}img/earth-topology.png`);
