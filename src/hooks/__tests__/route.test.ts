import { describe, expect, it } from 'vitest';
import { parseRoute, ROUTES } from '../useHashRoute';

describe('parseRoute', () => {
  it('resolves every navigation entry to itself', () => {
    for (const r of ROUTES) expect(parseRoute(r.hash)).toBe(r.route);
  });
  it('treats empty and bare hashes as home', () => {
    for (const h of ['', '#', '#/']) expect(parseRoute(h)).toBe('home');
  });
  it('ignores the query string', () => {
    expect(parseRoute('#/timeline?year=1965&gw=552')).toBe('timeline');
  });
  it('reports unknown addresses instead of silently showing home', () => {
    expect(parseRoute('#/nonsense')).toBe('notfound');
    expect(parseRoute('#/profile/extra')).toBe('notfound');
  });
});
