import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import Globe from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import type { GlobeMethods } from 'react-globe.gl';
import type { CountryFeature } from '../types/geo';
import { countryKey, loadCountries } from '../lib/countries';
import { analyzeCountry } from '../lib/geo';
import type { PolygonFeature } from '../lib/geo';
import { EARTH_BUMP_URL, EARTH_TEXTURE_URL } from '../lib/config';
import { escapeHtml } from '../lib/html';
import { webglAvailable } from '../lib/webgl';
import { displayName } from '../lib/names';
import GlobeLoader from './GlobeLoader';
import ZoomControls from './ZoomControls';

const EARTH_TEXTURE = EARTH_TEXTURE_URL;
const EARTH_BUMP = EARTH_BUMP_URL;

/** Device pixel ratio is capped: above 2× the extra pixels cost a lot of GPU time for no visible gain. */
const MAX_PIXEL_RATIO = 2;

/** Initial camera: centred over Europe / Africa, a classic "globe on a desk" view. */
const INITIAL_VIEW = { lat: 25, lng: 20, altitude: 2.2 };

/** How long the loader waits for the Earth texture before revealing the globe anyway. */
const TEXTURE_PATIENCE_MS = 10000;

/** Camera altitude limits (in globe radii). They mirror the OrbitControls min/max distance below. */
const MIN_ALTITUDE = 0.3;
const MAX_ALTITUDE = 4;

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; countries: CountryFeature[] }
  | { status: 'error'; message: string };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Methods the parent can call to drive the camera. */
export interface GlobeViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusCountry: (country: PolygonFeature) => void;
}

/** What the pointer is doing to a polygon, passed to custom colour functions. */
export type PolygonVisualState = 'selected' | 'hovered' | 'normal';

/** A 3D path / boundary line overlay rendered above the globe surface. */
export interface GlobePathOverlay {
  id: string;
  coords: [number, number][]; // [lng, lat]
  color?: string;
  stroke?: number;
  altitude?: number;
  dashLength?: number;
  dashGap?: number;
  label?: string;
}

/**
 * Without `polygons`, the globe loads and shows the modern Natural Earth borders itself (Phase 2
 * behaviour). With `polygons` (e.g. a historical snapshot), it shows exactly those and never
 * falls back to modern borders.
 */
export interface GlobeViewProps<F extends PolygonFeature = CountryFeature> {
  className?: string;
  /** Key of the selected polygon (see `keyOf`); it is highlighted and the camera flies to it. */
  selectedKey?: string | null;
  /** Called when a polygon is clicked. */
  onSelect?: (country: F) => void;
  /** Called once the built-in modern polygons have loaded (only when `polygons` is not given). */
  onCountriesLoaded?: (countries: CountryFeature[]) => void;
  /** Replaces the built-in dataset. Pass a stable reference (e.g. from useMemo). */
  polygons?: readonly F[];
  /** Stable identity of a polygon. Defaults to the modern-atlas key. Pass a module-level function. */
  keyOf?: (f: F) => string;
  /** HTML for the hover tooltip. Must escape any text it includes (see `escapeHtml`). */
  tooltipOf?: (f: F) => string;
  /** Cap colour of a polygon. Defaults to the Phase 2 blue/gold scheme. */
  polygonColor?: (f: F, state: PolygonVisualState) => string;
  /** Geographic path/boundary overlays rendered over the globe. */
  paths?: readonly GlobePathOverlay[];
  /** Content layered over the globe, e.g. a "no coverage" notice. */
  overlay?: ReactNode;
  /** Replaces the hint line under the globe. */
  hint?: string;
  ref?: Ref<GlobeViewHandle>;
}

export default function GlobeView<F extends PolygonFeature = CountryFeature>({
  className,
  selectedKey = null,
  onSelect,
  onCountriesLoaded,
  polygons: polygonsProp,
  keyOf,
  tooltipOf,
  polygonColor,
  paths = [],
  overlay,
  hint = 'Drag to rotate · Scroll or pinch to zoom · Click a country',
  ref,
}: GlobeViewProps<F>) {
  const external = polygonsProp !== undefined;
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedCallback = useRef(onCountriesLoaded);
  const lastFlownKey = useRef<string | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [data, setData] = useState<LoadState>(
    external ? { status: 'ready', countries: [] } : { status: 'loading' },
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [textureStatus, setTextureStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [textureSlow, setTextureSlow] = useState(false);
  const configured = useRef(false);
  const [webgl] = useState(() => webglAvailable());

  useEffect(() => {
    loadedCallback.current = onCountriesLoaded;
  }, [onCountriesLoaded]);

  // Track the Earth texture ourselves. react-globe.gl only reports "ready" once the texture
  // has downloaded, so if the image is unreachable (offline, blocked CDN) it would never fire.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setTextureStatus('ready');
    img.onerror = () => setTextureStatus('failed');
    img.src = EARTH_TEXTURE;
    const slow = window.setTimeout(() => setTextureSlow(true), TEXTURE_PATIENCE_MS);
    return () => {
      img.onload = null;
      img.onerror = null;
      window.clearTimeout(slow);
    };
  }, []);

  // Responsive sizing: the globe canvas always matches its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load modern country polygons from world-atlas (cached across mounts), unless the caller
  // supplies its own polygons.
  useEffect(() => {
    if (external) return;
    let cancelled = false;
    setData({ status: 'loading' });
    loadCountries()
      .then((countries) => {
        if (cancelled) return;
        setData({ status: 'ready', countries });
        loadedCallback.current?.(countries);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error loading map data',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, external]);

  // Camera + orbit controls, applied once the globe instance exists. Idempotent: it runs from
  // onGlobeReady and from a frame loop below, whichever gets there first.
  const configureGlobe = useCallback(() => {
    const globe = globeRef.current;
    if (!globe || configured.current) return;
    try {
      globe.pointOfView(INITIAL_VIEW, 0);
      const controls = globe.controls();
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.6;
      controls.zoomSpeed = 0.8;
      controls.minDistance = 100 * (1 + MIN_ALTITUDE);
      controls.maxDistance = 100 * (1 + MAX_ALTITUDE);
      controls.autoRotate = false;
      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      configured.current = true;
      setGlobeReady(true);
    } catch {
      // The WebGL instance isn't initialised yet; the frame loop retries.
    }
  }, []);

  const hasSize = size.width > 0 && size.height > 0;

  // Stop rendering while the tab is hidden or the globe is scrolled out of view, so it costs no GPU time.
  useEffect(() => {
    if (!globeReady) return;
    const el = containerRef.current;
    let tabVisible = document.visibilityState !== 'hidden';
    let inView = true;
    const apply = () => {
      const globe = globeRef.current;
      if (!globe) return;
      if (tabVisible && inView) globe.resumeAnimation();
      else globe.pauseAnimation();
    };
    const onVisibility = () => {
      tabVisible = document.visibilityState !== 'hidden';
      apply();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const io = el && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          inView = entries.some((e) => e.isIntersecting);
          apply();
        })
      : null;
    if (el && io) io.observe(el);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
      globeRef.current?.resumeAnimation();
    };
  }, [globeReady]);

  useEffect(() => {
    if (!hasSize) {
      configured.current = false;
      setGlobeReady(false);
      return;
    }
    let frame = requestAnimationFrame(function tick() {
      configureGlobe();
      if (!configured.current) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [hasSize, configureGlobe]);

  // Without the Earth texture, use a deep-navy sphere so the borders still read well.
  const fallbackMaterial = useMemo(
    () =>
      textureStatus === 'failed'
        ? new MeshPhongMaterial({ color: '#14336b', shininess: 8 })
        : undefined,
    [textureStatus],
  );

  const zoomBy = useCallback((factor: number) => {
    const globe = globeRef.current;
    if (!globe) return;
    const pov = globe.pointOfView();
    globe.pointOfView(
      { lat: pov.lat, lng: pov.lng, altitude: clamp(pov.altitude * factor, MIN_ALTITUDE, MAX_ALTITUDE) },
      450,
    );
  }, []);

  const resetView = useCallback(() => {
    globeRef.current?.pointOfView(INITIAL_VIEW, 1200);
  }, []);

  const focusCountry = useCallback((country: PolygonFeature) => {
    const { centre, focusAltitude } = analyzeCountry(country);
    globeRef.current?.pointOfView({ lat: centre.lat, lng: centre.lng, altitude: focusAltitude }, 1000);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomBy(0.65),
      zoomOut: () => zoomBy(1 / 0.65),
      resetView,
      focusCountry,
    }),
    [zoomBy, resetView, focusCountry],
  );

  const polygons = useMemo<PolygonFeature[]>(
    () => (external ? [...polygonsProp] : data.status === 'ready' ? data.countries : []),
    [external, polygonsProp, data],
  );

  const getKey = useCallback(
    (d: object): string => (keyOf ? keyOf(d as F) : countryKey(d as CountryFeature)),
    [keyOf],
  );

  // Fly to the selected country whenever the selection changes (click or search).
  useEffect(() => {
    if (!globeReady || selectedKey === null) {
      if (selectedKey === null) lastFlownKey.current = null;
      return;
    }
    if (lastFlownKey.current === selectedKey) return;
    const target = polygons.find((p) => getKey(p) === selectedKey);
    if (!target) return;
    lastFlownKey.current = selectedKey;
    focusCountry(target);
  }, [selectedKey, polygons, globeReady, focusCountry, getKey]);

  const altitudeOf = useCallback(
    (d: object) => {
      const key = getKey(d);
      if (key === selectedKey) return 0.045;
      if (key === hoveredKey) return 0.03;
      return 0.006;
    },
    [selectedKey, hoveredKey, getKey],
  );

  const capColorOf = useCallback(
    (d: object) => {
      const key = getKey(d);
      const state: PolygonVisualState =
        key === selectedKey ? 'selected' : key === hoveredKey ? 'hovered' : 'normal';
      if (polygonColor) return polygonColor(d as F, state);
      if (state === 'selected') return 'rgba(232, 196, 110, 0.78)';
      if (state === 'hovered') return 'rgba(212, 175, 95, 0.5)';
      return 'rgba(40, 80, 140, 0.28)';
    },
    [selectedKey, hoveredKey, getKey, polygonColor],
  );

  const strokeColorOf = useCallback(
    (d: object) =>
      getKey(d) === selectedKey ? 'rgba(255, 233, 160, 1)' : 'rgba(212, 175, 95, 0.75)',
    [selectedKey, getKey],
  );

  const labelOf = useCallback(
    (d: object) => {
      if (tooltipOf) return tooltipOf(d as F);
      const name = escapeHtml(displayName(d as CountryFeature));
      return `<div class="globe-tooltip"><strong>${name}</strong><span>Click for details</span></div>`;
    },
    [tooltipOf],
  );

  const isError = data.status === 'error';
  const textureSettled = textureStatus !== 'loading' || textureSlow;
  const loading = webgl && !isError && (data.status === 'loading' || !globeReady || !textureSettled);

  const loaderMessage = data.status === 'loading' ? 'Unrolling the map…' : 'Raising the globe…';
  const loaderDetail =
    data.status === 'loading'
      ? 'Fetching country boundaries'
      : !textureSettled
        ? 'Loading Earth imagery'
        : 'Rendering borders';

  const classes = ['globe-view', hoveredKey ? 'globe-view--pointer' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={classes} role="group" aria-label="Interactive 3D globe. Use the search box or the lists beside it to choose places without the mouse.">
      {hasSize && webgl && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={textureStatus === 'failed' ? null : EARTH_TEXTURE}
          bumpImageUrl={textureStatus === 'failed' ? null : EARTH_BUMP}
          globeMaterial={fallbackMaterial}
          showAtmosphere
          atmosphereColor="#6f9be0"
          atmosphereAltitude={0.18}
          polygonsData={polygons as object[]}
          polygonAltitude={altitudeOf}
          polygonCapColor={capColorOf}
          polygonSideColor={() => 'rgba(212, 175, 95, 0.12)'}
          polygonStrokeColor={strokeColorOf}
          polygonsTransitionDuration={external ? 0 : 250}
          polygonCapCurvatureResolution={6}
          rendererConfig={{ powerPreference: 'high-performance' }}
          polygonLabel={labelOf}
          onPolygonHover={(d) => setHoveredKey(d ? getKey(d) : null)}
          onPolygonClick={(d) => onSelect?.(d as F)}
          pathsData={paths as object[]}
          pathPoints={(d: object) => (d as GlobePathOverlay).coords}
          pathPointLat={(p: unknown) => (p as [number, number])[1]}
          pathPointLng={(p: unknown) => (p as [number, number])[0]}
          pathPointAlt={(d: object) => (d as GlobePathOverlay).altitude ?? 0.015}
          pathColor={(d: object) => (d as GlobePathOverlay).color ?? '#f59e0b'}
          pathStroke={(d: object) => (d as GlobePathOverlay).stroke ?? 2.5}
          pathDashLength={(d: object) => (d as GlobePathOverlay).dashLength ?? 0}
          pathDashGap={(d: object) => (d as GlobePathOverlay).dashGap ?? 0}
          pathLabel={(d: object) => (d as GlobePathOverlay).label ?? ''}
          pathResolution={3}
          onGlobeReady={configureGlobe}
        />
      )}

      <GlobeLoader visible={loading} message={loaderMessage} detail={loaderDetail} />

      {overlay}

      {!webgl && (
        <div className="globe-overlay globe-overlay--error" role="alert">
          <p className="globe-overlay__title">The 3D globe needs WebGL</p>
          <p className="globe-overlay__detail">
            This browser or device can’t create a WebGL view. Try a current version of Chrome, Firefox, Safari or Edge, enable
            hardware acceleration, or open this page on another device. The rest of the app that doesn’t need the globe still works.
          </p>
        </div>
      )}

      {textureStatus === 'failed' && !loading && (
        <p className="globe-notice" role="status">
          Earth imagery couldn’t be loaded, so a simplified globe is shown. Borders still work.
        </p>
      )}

      {isError && (
        <div className="globe-overlay globe-overlay--error" role="alert">
          <p className="globe-overlay__title">Couldn’t load the world map</p>
          <p className="globe-overlay__detail">{data.message}</p>
          <button type="button" className="btn" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      <ZoomControls
        onZoomIn={() => zoomBy(0.65)}
        onZoomOut={() => zoomBy(1 / 0.65)}
        onReset={resetView}
        disabled={!globeReady || !webgl}
      />
      <p className="globe-hint">{hint}</p>
    </div>
  );
}
