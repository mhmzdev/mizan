"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, {GeoJSONSource} from "maplibre-gl";
import React, {useEffect, useRef, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {X, Clock} from "lucide-react";
import {useNotesStore} from "@/stores/notesStore";
import {useMapStore} from "@/stores/mapStore";
import {useTimelineStore} from "@/stores/timelineStore";
import {useFormatYear} from "@/hooks/useFormatYear";
import {Note, Timeline} from "@/types";
import {YEAR_START, YEAR_END} from "@/utils/constants";

function parseYearInput(raw: string): number | null {
  const t = raw.trim().toUpperCase();
  let year: number;
  if (t.endsWith("BCE") || t.endsWith("BC")) {
    const suffix = t.endsWith("BCE") ? "BCE" : "BC";
    const num = parseInt(t.slice(0, -suffix.length).trim(), 10);
    if (isNaN(num)) return null;
    year = -num;
  } else if (t.endsWith("CE") || t.endsWith("AD")) {
    const suffix = t.endsWith("CE") ? "CE" : "AD";
    const num = parseInt(t.slice(0, -suffix.length).trim(), 10);
    if (isNaN(num)) return null;
    year = num - 1;
  } else if (t.endsWith("AH")) {
    const ah = parseInt(t.slice(0, -2).trim(), 10);
    if (isNaN(ah)) return null;
    const ce = Math.round(622 + (ah - 1) / 1.030684);
    year = ce >= 1 ? ce - 1 : ce;
  } else if (t.endsWith("BH")) {
    const bh = parseInt(t.slice(0, -2).trim(), 10);
    if (isNaN(bh)) return null;
    const ce = Math.round(622 - bh / 1.030684);
    year = ce >= 1 ? ce - 1 : ce;
  } else {
    const num = parseInt(t, 10);
    if (isNaN(num)) return null;
    year = num > 0 ? num - 1 : -num;
  }
  return Math.max(YEAR_START, Math.min(YEAR_END, year));
}

const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY;
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

function getMapStyle(isDark: boolean): string {
  // Tier 1 — Protomaps (fastest, dark/light, set NEXT_PUBLIC_PROTOMAPS_KEY)
  if (PROTOMAPS_KEY) {
    return isDark
      ? `https://api.protomaps.com/styles/v5/dark/en.json?key=${PROTOMAPS_KEY}`
      : `https://api.protomaps.com/styles/v5/light/en.json?key=${PROTOMAPS_KEY}`;
  }
  // Tier 2 — MapTiler (fast CDN, clean dark style, set NEXT_PUBLIC_MAPTILER_KEY)
  if (MAPTILER_KEY) {
    console.log("Using MapTiler basemaps");
    return isDark
      ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
      : `https://api.maptiler.com/maps/dataviz/style.json?key=${MAPTILER_KEY}`;
  }
  console.log("Using CARTO basemaps");
  // Tier 3 — CARTO free basemaps (no key required, slower shared CDN)
  return isDark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

/**
 * Wait until all visible tiles have actually rendered, then call `onReady`.
 * Falls back after 20 s for network failures.
 *
 * Why not poll `areTilesLoaded()` immediately after `load`?
 * At the `load` moment MapLibre has only parsed the style JSON — tile requests
 * haven't been issued yet, so `areTilesLoaded()` returns true vacuously,
 * the loader disappears, and the map stays blank.
 *
 * Waiting for the first `render` event ensures tile requests have been issued,
 * so `areTilesLoaded()` is meaningful from that point on.
 */
function waitForTiles(map: maplibregl.Map, onReady: () => void): void {
  const timer = setTimeout(onReady, 20_000);
  map.once("render", function poll() {
    if (map.areTilesLoaded()) {
      clearTimeout(timer);
      onReady();
    } else {
      map.once("render", poll);
    }
  });
}

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

function resolveTimelineColor(index: number): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--t-color-${index % 5}`)
    .trim();
}

function buildGeoJSON(
  notes: Note[],
  timelines: Timeline[],
  panelSearch: string,
  panelTimelineId: number | null,
): GeoJSON.FeatureCollection {
  const hiddenIds = new Set(timelines.filter((t) => t.hidden).map((t) => t.id!));
  const features: GeoJSON.Feature[] = [];
  const query = panelSearch.trim().toLowerCase();

  for (const note of notes) {
    if (note.lat == null || note.lng == null) continue;
    if (hiddenIds.has(note.timelineId)) continue;
    if (panelTimelineId !== null && note.timelineId !== panelTimelineId) continue;
    if (query && !note.title.toLowerCase().includes(query)) continue;
    const tlIndex = timelines.findIndex((t) => t.id === note.timelineId);
    const color = tlIndex >= 0 ? resolveTimelineColor(tlIndex) : "#74A0FF";

    features.push({
      type: "Feature",
      geometry: {type: "Point", coordinates: [note.lng, note.lat]},
      properties: {noteId: note.id, year: note.year, title: note.title, timelineId: note.timelineId, color},
    });
  }

  return {type: "FeatureCollection", features};
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterError, setFilterError] = useState(false);
  const fmt = useFormatYear();

  const notes = useNotesStore((s) => s.notes);
  const timelines = useNotesStore((s) => s.timelines);
  const panelSearch = useNotesStore((s) => s.panelSearch);
  const panelTimelineId = useNotesStore((s) => s.panelTimelineId);
  // Refs so callbacks always see latest values without re-running effects
  const notesRef = useRef(notes);
  const timelinesRef = useRef(timelines);
  const panelSearchRef = useRef(panelSearch);
  const panelTimelineIdRef = useRef(panelTimelineId);
  notesRef.current = notes;
  timelinesRef.current = timelines;
  panelSearchRef.current = panelSearch;
  panelTimelineIdRef.current = panelTimelineId;

  const mapCenter = useMapStore((s) => s.mapCenter);
  const mapZoom = useMapStore((s) => s.mapZoom);
  const setMapCenter = useMapStore((s) => s.setMapCenter);
  const setMapZoom = useMapStore((s) => s.setMapZoom);
  const drawerPreviewPin = useMapStore((s) => s.drawerPreviewPin);
  const locationPickMode = useMapStore((s) => s.locationPickMode);

  const editingNoteId = useNotesStore((s) => s.editingNoteId);
  const drawerOpen    = useNotesStore((s) => s.drawerOpen);

  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd = useTimelineStore((s) => s.rangeEnd);
  const clearRange = useTimelineStore((s) => s.clearRange);
  const rangeStartRef = useRef(rangeStart);
  const rangeEndRef = useRef(rangeEnd);
  rangeStartRef.current = rangeStart;
  rangeEndRef.current = rangeEnd;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Add the GeoJSON source + circle layers to the map (call once per style load). */
  function addNotesSource(map: maplibregl.Map) {
    if (map.getSource("notes")) return; // guard against double-registration on rapid toggles

    map.addSource("notes", {
      type: "geojson",
      data: buildGeoJSON(notesRef.current, timelinesRef.current, panelSearchRef.current, panelTimelineIdRef.current),
    });

    // Main circle dots
    map.addLayer({
      id: "notes-circles",
      type: "circle",
      source: "notes",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 10, 9, 16, 14],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.6,
      },
    });

    // Re-apply any active range filter immediately
    if (rangeStartRef.current !== null && rangeEndRef.current !== null) {
      map.setFilter("notes-circles", [
        "all",
        [">=", ["get", "year"], rangeStartRef.current],
        ["<=", ["get", "year"], rangeEndRef.current],
      ]);
    }
  }

  // ── Map initialisation — runs once on mount ─────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(isDarkTheme()),
      center: [mapCenter.lng, mapCenter.lat],
      zoom: mapZoom,
    });

    mapRef.current = map;

    // Persist camera position
    map.on("move", () => {
      const {lat, lng} = map.getCenter();
      setMapCenter({lat, lng});
      setMapZoom(map.getZoom());
    });

    // Initial style loaded: add notes layer + interaction handlers
    map.on("load", () => {
      // Ensure MapLibre knows the container's real dimensions before issuing
      // tile requests (guards against zero-size container on first mount).
      map.resize();
      // Darken tiles in dark mode — applied directly to canvas so DOM markers stay bright
      map.getCanvas().style.filter = isDarkTheme() ? "brightness(0.75)" : "";
      addNotesSource(map);

      // Hide loader only once all visible tiles are actually rendered
      waitForTiles(map, () => setLoaded(true));

      // Long-press state — 500 ms hold on empty area creates a new note
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressFired = false;
      let downPoint = {x: 0, y: 0};

      map.on("mousedown", (e) => {
        longPressFired = false;
        downPoint = {x: e.point.x, y: e.point.y};
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          const {lat, lng} = e.lngLat;
          const centerYear = useTimelineStore.getState().centerYear;
          useMapStore.getState().setDrawerPreviewPin({lat, lng, noteId: null});
          useNotesStore.getState().openDrawer(centerYear, undefined, undefined, undefined, lat, lng);
          longPressTimer = null;
        }, 500);
      });

      map.on("mouseup", () => {
        if (longPressTimer) {clearTimeout(longPressTimer); longPressTimer = null;}
      });

      // Cancel long press immediately when the user starts panning (item 4)
      map.on("dragstart", () => {
        if (longPressTimer) {clearTimeout(longPressTimer); longPressTimer = null;}
      });

      // Cursor feedback + cancel long press if moved
      map.on("mousemove", (e) => {
        if (longPressTimer) {
          const dx = e.point.x - downPoint.x;
          const dy = e.point.y - downPoint.y;
          if (Math.sqrt(dx * dx + dy * dy) > 6) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
        if (useMapStore.getState().locationPickMode) {
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        // Guard: layer may be absent briefly during setStyle() reloads
        if (!map.getLayer("notes-circles")) {map.getCanvas().style.cursor = ""; return;}
        const f = map.queryRenderedFeatures(e.point, {layers: ["notes-circles"]});
        map.getCanvas().style.cursor = f.length > 0 ? "pointer" : "";
      });

      // Click: pick-mode → assign location; pin → open note (glow); empty → no action
      map.on("click", (e) => {
        if (longPressFired) {longPressFired = false; return;}

        const {locationPickMode} = useMapStore.getState();
        if (locationPickMode) {
          const {lat, lng} = e.lngLat;
          useMapStore.getState().setPendingLocationPick({lat, lng});
          useMapStore.getState().setLocationPickMode(false);
          useMapStore.getState().setDrawerPreviewPin({lat, lng, noteId: null});
          return;
        }

        // Guard: layer may be absent briefly during setStyle() reloads
        if (!map.getLayer("notes-circles")) return;
        const features = map.queryRenderedFeatures(e.point, {layers: ["notes-circles"]});
        if (features.length > 0) {
          const noteId = Number(features[0].properties.noteId);
          const year   = Number(features[0].properties.year);
          useNotesStore.getState().openDrawer(year, noteId);
          return;
        }
        // Empty area single tap — no action; user must long press to add note
      });
    });

    // Watch data-theme changes → swap basemap style + rebuild note pins with new palette
    const observer = new MutationObserver(() => {
      if (!mapRef.current) return;
      const dark = isDarkTheme();
      setLoaded(false);

      // Cancel any handler registered by a previous rapid toggle so it doesn't
      // fire for a stale style and try to add sources that already exist.
      if (styleLoadHandlerRef.current) {
        mapRef.current.off("style.load", styleLoadHandlerRef.current);
      }

      styleLoadHandlerRef.current = () => {
        if (!mapRef.current) return;
        mapRef.current.resize();
        // Darken tiles on canvas only — DOM markers are unaffected
        mapRef.current.getCanvas().style.filter = dark ? "brightness(0.75)" : "";
        addNotesSource(mapRef.current);
        waitForTiles(mapRef.current, () => setLoaded(true));
      };

      // Register BEFORE setStyle to avoid a race where a cached style fires
      // style.load before once() is in place
      mapRef.current.once("style.load", styleLoadHandlerRef.current);
      mapRef.current.setStyle(getMapStyle(dark));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reactive: update GeoJSON when notes/timelines or panel filters change ──
  useEffect(() => {
    if (!mapRef.current?.isStyleLoaded()) return;
    (mapRef.current.getSource("notes") as GeoJSONSource | undefined)
      ?.setData(buildGeoJSON(notes, timelines, panelSearch, panelTimelineId));
  }, [notes, timelines, panelSearch, panelTimelineId]);

  // ── Reactive: apply year-range filter ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current?.isStyleLoaded()) return;
    if (!mapRef.current.getLayer("notes-circles")) return;
    mapRef.current.setFilter(
      "notes-circles",
      rangeStart !== null && rangeEnd !== null
        ? ["all", [">=", ["get", "year"], rangeStart], ["<=", ["get", "year"], rangeEnd]]
        : null
    );
  }, [rangeStart, rangeEnd]);

  // ── Reactive: fly to note when opened from the notes panel ────────────────
  useEffect(() => {
    if (!drawerOpen || editingNoteId == null || !mapRef.current) return;
    const note = useNotesStore.getState().notes.find((n) => n.id === editingNoteId);
    if (note?.lat == null || note?.lng == null) return;
    mapRef.current.flyTo({
      center: [note.lng, note.lat],
      zoom: Math.max(mapRef.current.getZoom(), 10),
      duration: 600,
      essential: true,
    });
  }, [editingNoteId, drawerOpen]);

  // ── Reactive: preview pin ────────────────────────────────────────────────
  useEffect(() => {
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
    if (!drawerPreviewPin || !mapRef.current) return;

    // Resolve the last-used timeline color for the preview pin
    const {timelines: storeTls, lastTimelineId} = useNotesStore.getState();
    const tlIdx = storeTls.findIndex((t) => t.id === lastTimelineId);
    const pinColor = tlIdx >= 0
      ? resolveTimelineColor(tlIdx)
      : getComputedStyle(document.documentElement).getPropertyValue("--color-no-blue").trim();

    const el = document.createElement("div");
    el.style.cssText = [
      "width:16px",
      "height:16px",
      "border-radius:50%",
      `background:${pinColor}`,
      "border:2.5px solid #ffffff",
      "animation:drawer-pin-pulse 1.8s ease-in-out infinite",
    ].join(";");

    previewMarkerRef.current = new maplibregl.Marker({element: el})
      .setLngLat([drawerPreviewPin.lng, drawerPreviewPin.lat])
      .addTo(mapRef.current);
  }, [drawerPreviewPin]);

  function applyFilter() {
    const from = parseYearInput(filterFrom);
    const to = parseYearInput(filterTo);
    if (from === null || to === null) {setFilterError(true); return;}
    useTimelineStore.getState().setRange(Math.min(from, to), Math.max(from, to));
    setFilterOpen(false);
    setFilterFrom("");
    setFilterTo("");
    setFilterError(false);
  }

  const rangeActive = rangeStart !== null && rangeEnd !== null;

  return (
    <div className="flex flex-1 w-full h-full relative overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {/* Map hint — pick-mode instruction or long-press guide */}
      {loaded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          {locationPickMode ? (
            <div className="bg-no-panel/90 border border-no-border rounded-lg px-4 py-2
                            text-no-text/80 text-[13px] tracking-wide backdrop-blur-sm">
              Click anywhere on the map to set location
            </div>
          ) : (
            <div className="bg-no-panel/70 border border-no-border/50 rounded-full px-3 py-1.5
                            text-no-text/80 text-[11px] font-mono tracking-wide select-none
                            backdrop-blur-sm shadow-sm">
              Long press to add note
            </div>
          )}
        </div>
      )}

      {/* Year range filter — bottom center */}
      {loaded && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center">
          {rangeActive ? (
            /* Active range badge */
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                            bg-no-panel/90 border border-no-blue/30 backdrop-blur-sm shadow-sm">
              <span className="text-no-blue/90 text-[12px] font-mono whitespace-nowrap">
                {fmt(rangeStart!)} — {fmt(rangeEnd!)}
              </span>
              <button
                onClick={clearRange}
                className="text-no-muted/50 hover:text-no-muted transition-colors"
                title="Clear year filter"
              >
                <X size={10} />
              </button>
            </div>
          ) : filterOpen ? (
            /* Year input form */
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                            bg-no-panel/95 border border-no-border/70 backdrop-blur-sm shadow-lg">
              <input
                autoFocus
                type="text"
                value={filterFrom}
                onChange={(e) => {setFilterFrom(e.target.value); setFilterError(false);}}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder={fmt(-500)}
                className={`w-[88px] bg-transparent text-no-text text-[12px] font-mono
                            placeholder:text-no-muted/40 focus:outline-none
                            ${filterError ? "text-red-400 placeholder:text-red-400/40" : ""}`}
              />
              <span className="text-no-muted/40 text-[11px] shrink-0">→</span>
              <input
                type="text"
                value={filterTo}
                onChange={(e) => {setFilterTo(e.target.value); setFilterError(false);}}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder={fmt(475)}
                className={`w-[88px] bg-transparent text-no-text text-[12px] font-mono
                            placeholder:text-no-muted/40 focus:outline-none
                            ${filterError ? "text-red-400 placeholder:text-red-400/40" : ""}`}
              />
              <button
                onClick={applyFilter}
                disabled={!filterFrom.trim() || !filterTo.trim()}
                className="px-2.5 py-0.5 rounded-md bg-no-blue/90 hover:bg-no-blue
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-no-blue-fg text-[11px] font-medium transition-colors shrink-0"
              >
                Apply
              </button>
              <button
                onClick={() => {setFilterOpen(false); setFilterFrom(""); setFilterTo(""); setFilterError(false);}}
                className="text-no-muted/40 hover:text-no-muted transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            /* Inactive trigger */
            <button
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                         bg-no-panel/80 border border-no-border/50 backdrop-blur-sm shadow-sm
                         text-no-text/80 text-[12px] hover:text-no-text hover:border-no-border
                         transition-colors"
            >
              <Clock size={11} />
              <span>Year filter</span>
            </button>
          )}
        </div>
      )}

      {/* Loading overlay — stays until all tiles have rendered, then fades out */}
      <AnimatePresence>
        {!loaded && (
          <motion.div
            key="map-loader"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 bg-no-bg pointer-events-none"
            exit={{opacity: 0}}
            transition={{duration: 0.45, ease: [0.4, 0, 0.2, 1]}}
          >
            {/* Logo + wordmark */}
            <motion.div
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.4, ease: "easeOut"}}
              className="flex flex-col items-center gap-5"
            >
              <svg
                width="72" height="56"
                viewBox="0 0 36 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-no-blue"
                aria-hidden="true"
              >
                <defs>
                  <filter id="map-loader-glow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="2" result="blur" in="SourceGraphic" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <line x1="1" y1="4" x2="35" y2="4" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
                <line x1="18" y1="2" x2="18" y2="6" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
                <line x1="1" y1="12" x2="35" y2="12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
                <line x1="18" y1="7" x2="18" y2="17" stroke="currentColor" strokeOpacity="1" strokeWidth="1.5" filter="url(#map-loader-glow)" />
                <line x1="1" y1="20" x2="35" y2="20" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
                <line x1="18" y1="18" x2="18" y2="22" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
                <text x="18" y="27" textAnchor="middle" fontFamily="monospace" fontSize="5"
                  fill="currentColor" fillOpacity="0.3">0</text>
              </svg>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-no-text text-[18px] font-mono font-semibold tracking-[0.35em] uppercase">
                  Mizan
                </span>
                <span className="text-no-muted/50 text-[11px] font-mono tracking-[0.15em] uppercase">
                  Fetching tiles…
                </span>
              </div>
            </motion.div>

            {/* Shimmer bar */}
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.15, duration: 0.35}}
              className="relative w-24 h-px bg-no-blue/15 rounded-full overflow-hidden"
            >
              <motion.div
                className="absolute inset-y-0 w-1/2 rounded-full"
                style={{background: "linear-gradient(to right, transparent, rgba(116,160,255,0.7), transparent)"}}
                animate={{x: ["-100%", "300%"]}}
                transition={{duration: 1.6, ease: "easeInOut", repeat: Infinity}}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
