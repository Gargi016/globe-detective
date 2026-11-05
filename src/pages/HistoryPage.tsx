import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import GlobeView from '../components/GlobeView';
import type { GlobeViewHandle } from '../components/GlobeView';
import ChangesPanel from '../components/history/ChangesPanel';
import CoverageNotice from '../components/history/CoverageNotice';
import EntityCard from '../components/history/EntityCard';
import EntityFinder from '../components/history/EntityFinder';
import StatusLegend from '../components/history/StatusLegend';
import TimelineBar from '../components/history/TimelineBar';
import GlobeLoader from '../components/GlobeLoader';
import { readHashParams, writeHashParams } from '../hooks/useHashRoute';
import { formatDate } from '../history/historyService';
import { browserStorage } from '../detective/investigation';
import { notifyProgressChanged } from '../profile/events';
import { recordYearViewed } from '../profile/profileStore';
import type { HistoryService } from '../history/historyService';
import { useHistoryService } from '../history/useHistoryService';
import type { HistoricalExample } from '../history/examples';
import type { Anchor, HistoricalFeature } from '../history/types';
import { colorOf, keyOf, tooltipOf } from '../components/history/globeStyle';

const DEFAULT_YEAR = 1960;
const EMPTY: readonly HistoricalFeature[] = [];

type Tab = 'selected' | 'changes' | 'find';

function parseYear(text: string | null): number | null {
  if (text === null || !/^\d{4}$/.test(text)) return null;
  return Number(text);
}

function parseAnchor(text: string | null): Anchor {
  return text === 'mid' || text === 'end' ? text : 'start';
}

function parseGw(text: string | null): number | null {
  return text !== null && /^\d{1,4}$/.test(text) ? Number(text) : null;
}

/** The year to open for an entity that does not exist on the shown date: the nearest year it does. */
function nearestYearWith(service: HistoryService, gw: number, date: string): number | null {
  const periods = service.periodsOf(gw);
  if (periods.length === 0) return null;
  const first = periods[0];
  const last = periods[periods.length - 1];
  const clamp = (iso: string) => Math.max(Number(iso.slice(0, 4)), service.meta.firstYear);
  if (date < first.start) return clamp(first.start);
  if (date > last.end) return clamp(last.end);
  const next = periods.find((p) => p.start > date);
  return next ? clamp(next.start) : clamp(last.end);
}

export default function HistoryPage() {
  const { load, retry } = useHistoryService();
  const service = load.status === 'ready' ? load.service : null;

  const initial = useMemo(() => readHashParams(), []);
  const [year, setYear] = useState<number>(() => parseYear(initial.get('year')) ?? DEFAULT_YEAR);
  const [anchor, setAnchor] = useState<Anchor>(() => parseAnchor(initial.get('a')));
  const [selectedGw, setSelectedGw] = useState<number | null>(() => parseGw(initial.get('gw')));
  const [tab, setTab] = useState<Tab>(() => (parseGw(initial.get('gw')) !== null ? 'selected' : 'changes'));
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const globeRef = useRef<GlobeViewHandle>(null);

  // Keep the slider responsive while a heavy snapshot is built.
  const shownYear = useDeferredValue(year);
  const stale = shownYear !== year;

  const snapshot = useMemo(() => service?.snapshot(shownYear, anchor) ?? null, [service, shownYear, anchor]);
  const features = snapshot?.covered ? snapshot.features : EMPTY;
  const date = snapshot?.date ?? '';
  useEffect(() => {
    if (snapshot?.covered && recordYearViewed(browserStorage(), shownYear)) notifyProgressChanged();
  }, [snapshot, shownYear]);

  const selectedFeature = useMemo(
    () => (selectedGw === null ? null : (features.find((f) => f.properties.gw === selectedGw) ?? null)),
    [features, selectedGw],
  );
  const selectedKey = selectedFeature?.properties.key ?? null;

  const changes = useMemo(() => service?.changesInYear(shownYear) ?? [], [service, shownYear]);
  const nameChanges = useMemo(() => service?.nameChangesInYear(shownYear) ?? [], [service, shownYear]);
  const markerYears = useMemo(() => service?.markerYears() ?? [], [service]);

  // Shareable URL: #/timeline?year=1965&gw=552
  useEffect(() => {
    writeHashParams('#/timeline', {
      year: String(year),
      a: anchor === 'start' ? null : anchor,
      gw: selectedGw === null ? null : String(selectedGw),
    });
  }, [year, anchor, selectedGw]);

  // Back/forward or a hand-edited URL: follow the hash when it differs from the current state.
  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash.startsWith('#/timeline')) return;
      const q = readHashParams();
      const y = parseYear(q.get('year')) ?? DEFAULT_YEAR;
      const gw = parseGw(q.get('gw'));
      setYear((cur) => (cur === y ? cur : y));
      setAnchor(parseAnchor(q.get('a')));
      setSelectedGw(gw);
      if (gw !== null) setTab('selected');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleYear = useCallback((y: number) => {
    setYear(y);
    setActiveExample(null);
  }, []);

  const handleExample = useCallback((ex: HistoricalExample) => {
    setYear(ex.year);
    setAnchor('start');
    setSelectedGw(ex.gw);
    setTab('selected');
    setActiveExample(ex.id);
  }, []);

  const handleSelect = useCallback((f: HistoricalFeature) => {
    setSelectedGw(f.properties.gw);
    setTab('selected');
    setActiveExample(null);
  }, []);

  const jumpToYear = useCallback((y: number, gw: number) => {
    setYear(y);
    setSelectedGw(gw);
    setTab('selected');
    setActiveExample(null);
  }, []);

  /** Select a state; if it does not exist on the shown date, open the nearest year it does. */
  const pickGw = useCallback(
    (gw: number) => {
      if (!service) return;
      setActiveExample(null);
      setTab('selected');
      if (date && service.existsOn(gw, date)) {
        setSelectedGw(gw);
        return;
      }
      const y = nearestYearWith(service, gw, date || `${DEFAULT_YEAR}-01-01`);
      if (y !== null) setYear(y);
      setSelectedGw(gw);
    },
    [service, date],
  );

  const clearSelection = useCallback(() => setSelectedGw(null), []);

  const gap = snapshot && !snapshot.covered ? snapshot.gap : null;
  const covered = snapshot?.covered === true;

  const overlay = (
    <>
      {load.status === 'loading' && (
        <GlobeLoader visible message="Opening the archive…" detail="Loading CShapes 2.0 boundaries" />
      )}
      {load.status === 'error' && (
        <div className="globe-overlay globe-overlay--error" role="alert">
          <p className="globe-overlay__title">Couldn’t load the historical data</p>
          <p className="globe-overlay__detail">{load.message}</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {gap && service && (
        <CoverageNotice
          gap={gap}
          firstYear={service.meta.firstYear}
          lastYear={service.meta.lastYear}
          onGoTo={handleYear}
        />
      )}
    </>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'selected', label: 'Selected' },
    { id: 'changes', label: 'Changes' },
    { id: 'find', label: 'Find' },
  ];

  return (
    <section className="atlas">
      <header className="atlas__head">
        <p className="eyebrow">Historical Geography Engine</p>
        <h1 className="page__title">
          Borders through <span>time</span>
        </h1>
        <p className="atlas__intro">
          Pick a year and watch states appear, change shape, change status and change name. Boundaries are CShapes 2.0
          polygons, coded by date from 1886 to 2019. Outside that range nothing is drawn.
        </p>
      </header>

      <TimelineBar
        year={year}
        anchor={anchor}
        date={date}
        coverageFirst={service?.meta.firstYear ?? 1886}
        coverageLast={service?.meta.lastYear ?? 2019}
        markerYears={markerYears}
        activeExampleId={activeExample}
        onYear={handleYear}
        onAnchor={setAnchor}
        onExample={handleExample}
      />

      <div className="atlas__body">
        <div className="atlas__globe">
          <div className={`atlas__globe-frame${stale ? ' is-stale' : ''}`}>
            <GlobeView<HistoricalFeature>
              ref={globeRef}
              polygons={features}
              keyOf={keyOf}
              tooltipOf={tooltipOf}
              polygonColor={colorOf}
              selectedKey={selectedKey}
              onSelect={handleSelect}
              overlay={overlay}
              hint="Drag to rotate · Scroll or pinch to zoom · Click a state"
            />
          </div>
          <StatusLegend
            counts={snapshot?.covered ? snapshot.counts : null}
            undefinedBoundaryCount={snapshot?.covered ? snapshot.undefinedBoundaryCount : 0}
          />
        </div>

        <aside className="atlas__panel panel" aria-label="Historical details">
          <p className="snapshot-line" aria-live="polite">
            {covered && snapshot?.covered ? (
              <>
                <strong>{formatDate(date)}</strong> · {snapshot.features.length} polygons
              </>
            ) : gap ? (
              <>
                <strong>No data</strong> · {gap.title}
              </>
            ) : (
              'Loading…'
            )}
          </p>

          <div className="tabs" role="tablist" aria-label="Details">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`tabpanel-${t.id}`}
                className="tabs__tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'selected' && selectedGw !== null ? ' ●' : ''}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabs__panel">
            {!service && load.status === 'loading' && <p className="muted">Loading the historical dataset…</p>}
            {service && tab === 'selected' &&
              (selectedGw !== null ? (
                <EntityCard
                  service={service}
                  gw={selectedGw}
                  feature={selectedFeature}
                  date={date || `${DEFAULT_YEAR}-01-01`}
                  onClose={clearSelection}
                  onFocus={() => selectedFeature && globeRef.current?.focusCountry(selectedFeature)}
                  onJumpToYear={jumpToYear}
                />
              ) : (
                <div className="panel__empty">
                  <div className="panel__empty-mark" aria-hidden="true">
                    ✦
                  </div>
                  <h2 className="panel__empty-title">Choose a state</h2>
                  <p>
                    Click a state on the globe, pick a case file above, or use Find to look up a state by any name it
                    has had.
                  </p>
                </div>
              ))}
            {service && tab === 'changes' && (
              <ChangesPanel
                year={shownYear}
                covered={covered}
                changes={changes}
                nameChanges={nameChanges}
                onSelectGw={pickGw}
              />
            )}
            {service && tab === 'find' && <EntityFinder service={service} date={date} onPick={pickGw} />}
          </div>
        </aside>
      </div>

      <p className="atlas__credit">
        Boundaries: CShapes 2.0 (Schvitz et al. 2022), generalised for the web; licence {service?.meta.license ?? 'CC BY-NC-SA 4.0'}, non-commercial
        use. See <a href="#/about">About</a> for the full citation, licence and limitations.
      </p>
    </section>
  );
}
