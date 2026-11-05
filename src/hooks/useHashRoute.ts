import { useEffect, useState } from 'react';

export type Route = 'home' | 'timeline' | 'detective' | 'challenge' | 'leaderboard' | 'profile' | 'about';

export const ROUTES: { route: Route; hash: string; label: string; modeSuffix?: string }[] = [
  { route: 'home', hash: '#/', label: 'Home' },
  { route: 'timeline', hash: '#/timeline', label: 'Timeline' },
  { route: 'detective', hash: '#/detective', label: 'Detective', modeSuffix: ' Mode' },
  { route: 'challenge', hash: '#/challenge', label: 'Challenge', modeSuffix: ' Mode' },
  { route: 'leaderboard', hash: '#/leaderboard', label: 'Leaderboard' },
  { route: 'profile', hash: '#/profile', label: 'Profile' },
  { route: 'about', hash: '#/about', label: 'About' },
];

/** The part of the hash before any "?query". */
function pathOf(hash: string): string {
  return hash.split('?')[0];
}

/** What the hash resolves to: a known page, or 'notfound' for an address the app doesn't have. */
export type ResolvedRoute = Route | 'notfound';

export function parseRoute(hash: string): ResolvedRoute {
  const path = pathOf(hash);
  const found = ROUTES.find((r) => r.hash === path || (r.route === 'home' && (path === '' || path === '#' || path === '#/')));
  return found ? found.route : 'notfound';
}

/** Minimal hash router: back/forward, refresh and deep links all work with no extra dependency. */
export function useHashRoute(): ResolvedRoute {
  const [route, setRoute] = useState<ResolvedRoute>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Reads "?a=b" parameters from the hash, e.g. "#/timeline?year=1965". */
export function readHashParams(): URLSearchParams {
  const q = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

/** Updates the hash query without adding history entries or triggering a re-route. */
export function writeHashParams(path: string, params: Record<string, string | null>): void {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== '') qs.set(k, v);
  const next = `${path}${qs.size ? `?${qs.toString()}` : ''}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}
