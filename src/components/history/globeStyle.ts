import type { PolygonVisualState } from '../GlobeView';
import { STATUS_LABEL } from '../../history/types';
import type { HistoricalFeature } from '../../history/types';
import { escapeHtml } from '../../lib/html';
import { STATUS_COLOR } from './StatusLegend';

/** Shared by every page that draws a historical snapshot. Module-level so identities stay stable. */
export const keyOf = (f: HistoricalFeature) => f.properties.key;

export function tooltipOf(f: HistoricalFeature): string {
  const p = f.properties;
  const status = p.ownerName ? `${STATUS_LABEL[p.status]} of ${p.ownerName}` : STATUS_LABEL[p.status];
  return `<div class="globe-tooltip"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(status)}</span><span>Click for details</span></div>`;
}

function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}

export function colorOf(f: HistoricalFeature, state: PolygonVisualState): string {
  const p = f.properties;
  const alpha = state === 'selected' ? 0.92 : state === 'hovered' ? 0.75 : p.boundaryDefined ? 0.52 : 0.26;
  return withAlpha(STATUS_COLOR[p.status], alpha);
}
