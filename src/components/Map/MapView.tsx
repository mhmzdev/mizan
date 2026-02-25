"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, {GeoJSONSource} from "maplibre-gl";
import React, {useEffect, useRef, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {Clock} from "lucide-react";
import {useNotesStore} from "@/stores/notesStore";
import {useMapStore} from "@/stores/mapStore";
import {useTimelineStore} from "@/stores/timelineStore";
import {Note, Timeline, TimelineEvent} from "@/types";
import {TimeSlider} from "./TimeSlider";
import {YEAR_START, YEAR_END} from "@/utils/constants";
import {mizanYearToDecimal} from "@/utils/yearUtils";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

const OHM_STYLE_URL = "https://www.openhistoricalmap.org/map-styles/main/main.json";

function getMapStyle(isDark: boolean): string {
  if (MAPTILER_KEY) {
    return isDark
      ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
      : `https://api.maptiler.com/maps/dataviz/style.json?key=${MAPTILER_KEY}`;
  }
  return isDark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

/**
 * Apply OHM temporal date filter to all vector tile layers.
 * OHM features expose `start_decdate` / `end_decdate` (astronomical decimal years).
 * Features without those properties are always shown (timeless basemap elements).
 *
 * Note: OHM encodes decdate values as strings in some layers, so we coerce with
 * `to-number` before comparing to avoid MapLibre's type-mismatch errors.
 */
function applyOHMDateFilter(map: maplibregl.Map, year: number): void {
  if (!map.isStyleLoaded()) return;
  const decYear = mizanYearToDecimal(year);
  const filter: maplibregl.FilterSpecification = [
    "all",
    ["any", ["!", ["has", "start_decdate"]], ["<=", ["to-number", ["get", "start_decdate"]], decYear]],
    ["any", ["!", ["has", "end_decdate"]],   [">=", ["to-number", ["get", "end_decdate"]],   decYear]],
  ];
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (!("source-layer" in layer)) continue;
    if (layer.id === "notes-circles" || layer.id === "events-circles") continue;
    try { map.setFilter(layer.id, filter); } catch { /* ignore unsupported layers */ }
  }
}

/**
 * Remove OHM's unreliable external raster sources (landcover/hillshade/DEM hosted on
 * static-tiles-lclu.s3.us-west-1.amazonaws.com) and disable 3D terrain to prevent
 * MapLibre from spamming connection-reset errors every render frame.
 * The vector tile layers still render fine without these.
 */
function removeUnreliableOHMSources(map: maplibregl.Map): void {
  if (!map.isStyleLoaded()) return;

  // Disable 3D terrain first — it references the S3 DEM source and triggers
  // a tile fetch on every render frame once activated by the OHM style load.
  try { map.setTerrain(null); } catch { /* ignore if terrain not supported */ }

  const style = map.getStyle();
  if (!style?.sources) return;
  for (const [sourceId, source] of Object.entries(style.sources)) {
    const s = source as { type?: string; tiles?: string[]; url?: string };
    const tileUrl = s.tiles?.[0] ?? s.url ?? "";
    if (tileUrl.includes("static-tiles-lclu.s3")) {
      // Remove dependent layers before removing the source
      const layersToRemove = (style.layers ?? []).filter(
        (l) => "source" in l && l.source === sourceId
      );
      for (const l of layersToRemove) {
        if (map.getLayer(l.id)) map.removeLayer(l.id);
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }
}

/**
 * Remap all OHM symbol layer text-field expressions to prefer `name:en` over
 * the local-script `name` tag. OHM uses local names by default, which produces
 * Russian, Ukrainian, Arabic, Greek etc. labels depending on the region.
 * We walk every symbol layer and replace bare `["get", "name"]` references
 * with `["coalesce", ["get", "name:en"], ["get", "name"]]`.
 */
function fixOHMLanguage(map: maplibregl.Map): void {
  if (!map.isStyleLoaded()) return;
  const style = map.getStyle();
  for (const layer of style?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const tf = (layer as maplibregl.SymbolLayerSpecification).layout?.["text-field"];
    if (!tf) continue;
    // Match the two forms OHM uses: legacy "{name}" template or ["get", "name"] expr
    const isBareName =
      tf === "{name}" ||
      (Array.isArray(tf) && tf.length === 2 && tf[0] === "get" && tf[1] === "name");
    if (!isBareName) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field",
        ["coalesce", ["get", "name:en"], ["get", "name"]]);
    } catch { /* ignore layers that reject layout updates */ }
  }
}

/**
 * Apply the correct CSS filter to the map container div.
 * In dark mode we dim the map canvas slightly so it sits better against the dark UI.
 * For OHM (a light-toned map) we use a very gentle dim only — heavier filters
 * also darken our note/event pins (which live on the same WebGL canvas) making
 * them hard to see against the washed-out background.
 */
function applyContainerFilter(el: HTMLElement | null, historyModeOn: boolean): void {
  if (!el) return;
  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  if (historyModeOn) {
    // OHM is a light map — gentle dim only, no sepia, so colored pins stay visible
    el.style.filter = dark ? "brightness(0.82)" : "";
  } else {
    el.style.filter = dark ? "brightness(0.75)" : "";
  }
}

/**
 * Wait until all visible tiles have actually rendered, then call `onReady`.
 * Falls back after 20 s for network failures.
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

function buildEventsGeoJSON(
  events: TimelineEvent[],
  timelines: Timeline[],
  panelSearch: string,
  panelTimelineId: number | null,
): GeoJSON.FeatureCollection {
  const globalTl = timelines.find((t) => t.eventTrack === "global")
    ?? timelines.filter((t) => t.isDefault).sort((a, b) => a.createdAt - b.createdAt)[0];
  if (globalTl?.hidden) return {type: "FeatureCollection", features: []};
  if (panelTimelineId !== null && panelTimelineId !== globalTl?.id) {
    return {type: "FeatureCollection", features: []};
  }

  const query = panelSearch.trim().toLowerCase();
  const globalIdx = globalTl ? timelines.indexOf(globalTl) : -1;
  const color = globalIdx >= 0 ? resolveTimelineColor(globalIdx) : "#74A0FF";

  const features: GeoJSON.Feature[] = events
    .filter((ev) => ev.lat != null && ev.lng != null)
    .filter((ev) => !query || ev.title.toLowerCase().includes(query))
    .map((ev) => ({
      type: "Feature" as const,
      geometry: {type: "Point" as const, coordinates: [ev.lng!, ev.lat!]},
      properties: {eventId: ev.id, year: ev.year, title: ev.title, color},
    }));

  return {type: "FeatureCollection", features};
}

export default function MapView({events}: {events: TimelineEvent[]}) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<maplibregl.Map | null>(null);
  const previewMarkerRef  = useRef<maplibregl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);

  const notes          = useNotesStore((s) => s.notes);
  const timelines      = useNotesStore((s) => s.timelines);
  const panelSearch    = useNotesStore((s) => s.panelSearch);
  const panelTimelineId = useNotesStore((s) => s.panelTimelineId);
  const notesRef         = useRef(notes);
  const timelinesRef     = useRef(timelines);
  const panelSearchRef   = useRef(panelSearch);
  const panelTimelineIdRef = useRef(panelTimelineId);
  const eventsRef        = useRef(events);
  notesRef.current         = notes;
  timelinesRef.current     = timelines;
  panelSearchRef.current   = panelSearch;
  panelTimelineIdRef.current = panelTimelineId;
  eventsRef.current        = events;

  const mapCenter       = useMapStore((s) => s.mapCenter);
  const mapZoom         = useMapStore((s) => s.mapZoom);
  const setMapCenter    = useMapStore((s) => s.setMapCenter);
  const setMapZoom      = useMapStore((s) => s.setMapZoom);
  const drawerPreviewPin = useMapStore((s) => s.drawerPreviewPin);
  const locationPickMode = useMapStore((s) => s.locationPickMode);
  const mapRangeStart   = useMapStore((s) => s.mapRangeStart);
  const mapRangeEnd     = useMapStore((s) => s.mapRangeEnd);
  const historyMode     = useMapStore((s) => s.historyMode);
  const historyYear     = useMapStore((s) => s.historyYear);
  const setHistoryMode  = useMapStore((s) => s.setHistoryMode);
  const setHistoryYear  = useMapStore((s) => s.setHistoryYear);

  const rangeStartRef  = useRef(mapRangeStart);
  const rangeEndRef    = useRef(mapRangeEnd);
  const historyModeRef = useRef(historyMode);
  const historyYearRef = useRef(historyYear);
  rangeStartRef.current  = mapRangeStart;
  rangeEndRef.current    = mapRangeEnd;
  historyModeRef.current = historyMode;
  historyYearRef.current = historyYear;

  const editingNoteId      = useNotesStore((s) => s.editingNoteId);
  const drawerOpen         = useNotesStore((s) => s.drawerOpen);
  const pendingSourceEvent = useNotesStore((s) => s.pendingSourceEvent);

  const historyYearDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function addNotesSource(map: maplibregl.Map) {
    if (map.getSource("notes")) return;
    map.addSource("notes", {
      type: "geojson",
      data: buildGeoJSON(notesRef.current, timelinesRef.current, panelSearchRef.current, panelTimelineIdRef.current),
    });
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
    if (rangeStartRef.current !== null && rangeEndRef.current !== null) {
      map.setFilter("notes-circles", [
        "all",
        [">=", ["get", "year"], rangeStartRef.current],
        ["<=", ["get", "year"], rangeEndRef.current],
      ]);
    }
  }

  function addEventsSource(map: maplibregl.Map) {
    if (map.getSource("events")) return;
    map.addSource("events", {
      type: "geojson",
      data: buildEventsGeoJSON(eventsRef.current, timelinesRef.current, panelSearchRef.current, panelTimelineIdRef.current),
    });
    map.addLayer({
      id: "events-circles",
      type: "circle",
      source: "events",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 6, 16, 10],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.75,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.4,
      },
    });
    if (rangeStartRef.current !== null && rangeEndRef.current !== null) {
      map.setFilter("events-circles", [
        "all",
        [">=", ["get", "year"], rangeStartRef.current],
        ["<=", ["get", "year"], rangeEndRef.current],
      ]);
    }
  }

  // ── Map initialisation — runs once on mount ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // If history mode is already on (restored from localStorage), start with OHM tiles
    const initialHistoryMode = useMapStore.getState().historyMode;

    const map = new maplibregl.Map({
      container: el,
      style: initialHistoryMode ? OHM_STYLE_URL : getMapStyle(isDarkTheme()),
      center: [mapCenter.lng, mapCenter.lat],
      zoom: mapZoom,
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    map.on("move", () => {
      const {lat, lng} = map.getCenter();
      setMapCenter({lat, lng});
      setMapZoom(map.getZoom());
    });

    map.on("load", () => {
      // Apply container-level CSS filter (handles both modern dark dimming + OHM toning)
      applyContainerFilter(el, historyModeRef.current);
      // If history mode was already active, apply OHM date filter + clean up bad sources
      if (historyModeRef.current) {
        removeUnreliableOHMSources(map);
        applyOHMDateFilter(map, historyYearRef.current);
        fixOHMLanguage(map);
      }
      addNotesSource(map);
      addEventsSource(map);

      // "Go to map" case: map mounts while a note is already open.
      const {editingNoteId: eid, drawerOpen: dOpen, notes: ns} = useNotesStore.getState();
      if (dOpen && eid != null) {
        const n = ns.find((n) => n.id === eid);
        const ev = n?.sourceEventId ? eventsRef.current.find((e) => e.id === n.sourceEventId) : null;
        const lat = n?.lat ?? ev?.lat;
        const lng = n?.lng ?? ev?.lng;
        if (lat != null && lng != null) {
          map.flyTo({center: [lng, lat], zoom: Math.max(map.getZoom(), 10), duration: 600, essential: true});
        }
      }

      waitForTiles(map, () => setLoaded(true));

      // Long-press: 500 ms hold on empty area creates a new note
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

      map.on("dragstart", () => {
        if (longPressTimer) {clearTimeout(longPressTimer); longPressTimer = null;}
      });

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
        if (!map.getLayer("notes-circles")) {map.getCanvas().style.cursor = ""; return;}
        const activeLayers = ["notes-circles", map.getLayer("events-circles") ? "events-circles" : ""].filter(Boolean);
        const f = map.queryRenderedFeatures(e.point, {layers: activeLayers});
        map.getCanvas().style.cursor = f.length > 0 ? "pointer" : "";
      });

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

        if (!map.getLayer("notes-circles")) return;

        const noteFeatures = map.queryRenderedFeatures(e.point, {layers: ["notes-circles"]});
        if (noteFeatures.length > 0) {
          const noteId = Number(noteFeatures[0].properties.noteId);
          const year   = Number(noteFeatures[0].properties.year);
          useNotesStore.getState().openDrawer(year, noteId);
          return;
        }

        if (map.getLayer("events-circles")) {
          const evFeatures = map.queryRenderedFeatures(e.point, {layers: ["events-circles"]});
          if (evFeatures.length > 0) {
            const eventId = String(evFeatures[0].properties.eventId);
            const year    = Number(evFeatures[0].properties.year);
            const title   = String(evFeatures[0].properties.title);
            const ev = eventsRef.current.find((ev) => ev.id === eventId);
            if (ev) {
              if (ev.lat != null && ev.lng != null) {
                map.flyTo({center: [ev.lng, ev.lat], zoom: Math.max(map.getZoom(), 10), duration: 600, essential: true});
              }
              useNotesStore.getState().openDrawer(year, undefined, title, ev);
            }
            return;
          }
        }
      });
    });

    // Watch data-theme changes → swap basemap (only when not in history mode)
    const observer = new MutationObserver(() => {
      if (!mapRef.current) return;
      const dark = isDarkTheme();

      // Always update the container CSS filter regardless of mode
      applyContainerFilter(containerRef.current, historyModeRef.current);

      // In history mode, OHM style is theme-independent — just re-apply date filter
      if (historyModeRef.current) {
        if (mapRef.current.isStyleLoaded()) {
          applyOHMDateFilter(mapRef.current, historyYearRef.current);
        }
        return;
      }

      // Modern map — swap to dark/light variant
      setLoaded(false);
      if (styleLoadHandlerRef.current) {
        mapRef.current.off("style.load", styleLoadHandlerRef.current);
      }
      styleLoadHandlerRef.current = () => {
        if (!mapRef.current) return;
        mapRef.current.resize();
        applyContainerFilter(containerRef.current, historyModeRef.current);
        if (historyModeRef.current) {
          removeUnreliableOHMSources(mapRef.current);
          applyOHMDateFilter(mapRef.current, historyYearRef.current);
          fixOHMLanguage(mapRef.current);
        }
        addNotesSource(mapRef.current);
        addEventsSource(mapRef.current);
        waitForTiles(mapRef.current, () => setLoaded(true));
      };
      mapRef.current.once("style.load", styleLoadHandlerRef.current);
      mapRef.current.setStyle(getMapStyle(dark));
    });
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});

    return () => {
      ro.disconnect();
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reactive: toggle history mode ───────────────────────────────────────
  const historyModeInitRef = useRef(true);
  useEffect(() => {
    // Skip the initial mount run — the map init effect handles the first style load
    if (historyModeInitRef.current) { historyModeInitRef.current = false; return; }
    if (!mapRef.current) return;
    const map = mapRef.current;

    setLoaded(false);
    if (styleLoadHandlerRef.current) {
      map.off("style.load", styleLoadHandlerRef.current);
    }
    styleLoadHandlerRef.current = () => {
      if (!mapRef.current) return;
      map.resize();
      applyContainerFilter(containerRef.current, historyMode);
      if (historyMode) {
        removeUnreliableOHMSources(map);
        applyOHMDateFilter(map, historyYearRef.current);
        fixOHMLanguage(map);
      }
      addNotesSource(map);
      addEventsSource(map);
      waitForTiles(map, () => setLoaded(true));
    };
    // Register before setStyle to avoid race with cached styles
    map.once("style.load", styleLoadHandlerRef.current);
    map.setStyle(historyMode ? OHM_STYLE_URL : getMapStyle(isDarkTheme()));
    // Update CSS filter immediately (loading overlay covers the map during transition)
    applyContainerFilter(containerRef.current, historyMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyMode]);

  // ── Reactive: update OHM date filter when history year changes ───────────
  useEffect(() => {
    if (!historyMode) return;
    if (historyYearDebounceRef.current) clearTimeout(historyYearDebounceRef.current);
    historyYearDebounceRef.current = setTimeout(() => {
      if (mapRef.current?.isStyleLoaded()) {
        applyOHMDateFilter(mapRef.current, historyYear);
      }
      historyYearDebounceRef.current = null;
    }, 150);
    return () => {
      if (historyYearDebounceRef.current) {
        clearTimeout(historyYearDebounceRef.current);
        historyYearDebounceRef.current = null;
      }
    };
  }, [historyYear, historyMode]);

  // ── Reactive: update GeoJSON when notes/timelines or panel filters change ──
  useEffect(() => {
    if (!mapRef.current?.isStyleLoaded()) return;
    (mapRef.current.getSource("notes") as GeoJSONSource | undefined)
      ?.setData(buildGeoJSON(notes, timelines, panelSearch, panelTimelineId));
  }, [notes, timelines, panelSearch, panelTimelineId]);

  // ── Reactive: apply year-range filter to both notes and events ───────────
  useEffect(() => {
    if (!mapRef.current?.isStyleLoaded()) return;
    const filter = ["all",
      [">=", ["get", "year"], mapRangeStart],
      ["<=", ["get", "year"], mapRangeEnd],
    ] as maplibregl.FilterSpecification;
    if (mapRef.current.getLayer("notes-circles")) mapRef.current.setFilter("notes-circles", filter);
    if (mapRef.current.getLayer("events-circles")) mapRef.current.setFilter("events-circles", filter);
  }, [mapRangeStart, mapRangeEnd]);

  // ── Reactive: update events GeoJSON ─────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current?.isStyleLoaded()) return;
    (mapRef.current.getSource("events") as GeoJSONSource | undefined)
      ?.setData(buildEventsGeoJSON(events, timelines, panelSearch, panelTimelineId));
  }, [events, timelines, panelSearch, panelTimelineId]);

  // ── Reactive: fly to note/event when drawer opens ────────────────────────
  useEffect(() => {
    if (!drawerOpen || !mapRef.current) return;
    let lat:  number | undefined;
    let lng:  number | undefined;
    let year: number | undefined;

    if (editingNoteId != null) {
      const note = useNotesStore.getState().notes.find((n) => n.id === editingNoteId);
      const ev = note?.sourceEventId ? eventsRef.current.find((e) => e.id === note.sourceEventId) : null;
      lat  = note?.lat  ?? ev?.lat;
      lng  = note?.lng  ?? ev?.lng;
      year = note?.year ?? ev?.year;
    } else if (pendingSourceEvent?.lat != null && pendingSourceEvent?.lng != null) {
      lat  = pendingSourceEvent.lat;
      lng  = pendingSourceEvent.lng;
      year = pendingSourceEvent.year;
    }

    if (year !== undefined) {
      const { mapRangeStart, mapRangeEnd, setMapRange } = useMapStore.getState();
      const windowSize = mapRangeEnd - mapRangeStart;
      if (year < mapRangeStart) {
        const newStart = Math.max(YEAR_START, year);
        setMapRange(newStart, newStart + windowSize);
      } else if (year > mapRangeEnd) {
        const newEnd = Math.min(YEAR_END, year);
        setMapRange(Math.max(YEAR_START, newEnd - windowSize), newEnd);
      }
    }

    if (lat == null || lng == null) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: Math.max(mapRef.current.getZoom(), 10),
      duration: 600,
      essential: true,
    });
  }, [editingNoteId, drawerOpen, pendingSourceEvent]);

  // ── Reactive: preview pin ─────────────────────────────────────────────────
  useEffect(() => {
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
    if (!drawerPreviewPin || !mapRef.current) return;

    const {timelines: storeTls, lastTimelineId} = useNotesStore.getState();
    const tlIdx = storeTls.findIndex((t) => t.id === lastTimelineId);
    const pinColor = tlIdx >= 0
      ? resolveTimelineColor(tlIdx)
      : getComputedStyle(document.documentElement).getPropertyValue("--color-no-blue").trim();

    const el = document.createElement("div");
    el.style.cssText = [
      "width:16px", "height:16px", "border-radius:50%",
      `background:${pinColor}`,
      "border:2.5px solid #ffffff",
      "animation:drawer-pin-pulse 1.8s ease-in-out infinite",
    ].join(";");

    previewMarkerRef.current = new maplibregl.Marker({element: el})
      .setLngLat([drawerPreviewPin.lng, drawerPreviewPin.lat])
      .addTo(mapRef.current);
  }, [drawerPreviewPin]);

  // ── History toggle handler ────────────────────────────────────────────────
  function handleHistoryToggle() {
    const next = !historyMode;
    // When turning on: snap history year to range midpoint if outside the slider window
    if (next) {
      const { mapRangeStart, mapRangeEnd, historyYear: hy } = useMapStore.getState();
      if (hy < mapRangeStart || hy > mapRangeEnd) {
        setHistoryYear(Math.round((mapRangeStart + mapRangeEnd) / 2));
      }
    }
    setHistoryMode(next);
  }

  return (
    <div className="flex flex-1 w-full h-full relative overflow-hidden">
      <div className="absolute inset-0">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Map hint — pick-mode instruction or long-press guide */}
      {loaded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          {locationPickMode ? (
            <div className="bg-no-panel/90 border border-no-border rounded-lg px-4 py-2
                            text-no-text/80 text-[13px] tracking-wide backdrop-blur-sm">
              Click anywhere on the map to set location
            </div>
          ) : (
            <div
              data-tour="tour-map-hint"
              className="bg-no-panel/70 border border-no-border/50 rounded-full px-3 py-1.5
                         text-no-text/80 text-[11px] font-mono tracking-wide select-none
                         backdrop-blur-sm shadow-sm"
            >
              Long press to add note
            </div>
          )}
        </div>
      )}

      {/* Historical map toggle button */}
      {loaded && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleHistoryToggle}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
              "border text-[11px] font-mono tracking-wide",
              "backdrop-blur-sm transition-colors select-none",
              historyMode
                ? "bg-amber-500/15 border-amber-400/40 text-amber-300 hover:bg-amber-500/20"
                : "bg-no-panel/75 border-no-border/60 text-no-muted hover:text-no-text hover:border-no-border",
            ].join(" ")}
            title={historyMode ? "Switch to modern map" : "Show historical map (OpenHistoricalMap)"}
          >
            <Clock size={12} />
            Historical
          </button>
        </div>
      )}

      {/* Time slider — always visible once map tiles are loaded */}
      {loaded && <TimeSlider />}

      {/* Loading overlay */}
      <AnimatePresence>
        {!loaded && (
          <motion.div
            key="map-loader"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 bg-no-bg pointer-events-none"
            exit={{opacity: 0}}
            transition={{duration: 0.45, ease: [0.4, 0, 0.2, 1]}}
          >
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
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <line x1="1" y1="4"  x2="35" y2="4"  stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
                <line x1="18" y1="2" x2="18" y2="6"  stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
                <line x1="1" y1="12" x2="35" y2="12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
                <line x1="18" y1="7" x2="18" y2="17" stroke="currentColor" strokeOpacity="1"    strokeWidth="1.5" filter="url(#map-loader-glow)" />
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
                  {historyMode ? "Loading historical map…" : "Fetching tiles…"}
                </span>
              </div>
            </motion.div>
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
