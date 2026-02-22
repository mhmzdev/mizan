"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTourStore, TOUR_DONE_KEY, TOUR_STEPS } from "@/stores/tourStore";

interface Rect { x: number; y: number; width: number; height: number; }

const CARD_W   = 340;
const PAD      = 12;   // spotlight padding around target element

const STEPS = [
  {
    target:  "tour-timeline",
    title:   "Navigate the Timeline",
    body:    "Scroll to zoom between centuries and individual years. Hold ⇧ Shift while scrolling to pan. Press 1, 2, or 3 to jump between zoom levels instantly.",
    cta:     "Next",
  },
  {
    target:  "tour-sidebar",
    title:   "Create a Timeline",
    body:    "Timelines organize your notes by category. Click + in the Timelines section to add one — each gets its own color and can be hidden anytime.",
    cta:     "Next",
  },
  {
    target:  "tour-notes",
    title:   "Add a Note",
    body:    "Click + in the notes panel to create a note at any year. Notes support rich text, markdown links, and can be deep-linked back to this exact view.",
    cta:     "Got it!",
  },
] as const;

/** Find the best position for the tooltip card relative to the spotlight rect. */
function getTooltipPos(rect: Rect, cardH: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M  = 20; // margin from spotlight / viewport edge

  const sx = rect.x - PAD;
  const sy = rect.y - PAD;
  const sw = rect.width  + PAD * 2;
  const sh = rect.height + PAD * 2;

  const spaceBelow = vh - (sy + sh);
  const spaceAbove = sy;
  const spaceLeft  = sx;
  const spaceRight = vw - (sx + sw);

  let x: number, y: number;

  if (spaceBelow >= cardH + M * 2) {
    x = sx + sw / 2 - CARD_W / 2;
    y = sy + sh + M;
  } else if (spaceAbove >= cardH + M * 2) {
    x = sx + sw / 2 - CARD_W / 2;
    y = sy - cardH - M;
  } else if (spaceLeft >= CARD_W + M * 2) {
    x = sx - CARD_W - M;
    y = sy + sh / 2 - cardH / 2;
  } else if (spaceRight >= CARD_W + M * 2) {
    x = sx + sw + M;
    y = sy + sh / 2 - cardH / 2;
  } else {
    // Fallback: lower-center of the highlighted area
    x = sx + sw / 2 - CARD_W / 2;
    y = sy + sh * 0.55;
  }

  // Clamp to viewport
  x = Math.max(M, Math.min(vw - CARD_W - M, x));
  y = Math.max(M, Math.min(vh - cardH   - M, y));
  return { x, y };
}

export function TourOverlay() {
  const { active, step, next, skip } = useTourStore();

  const [rect,  setRect]  = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-start on very first visit
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(TOUR_DONE_KEY)) {
      const t = setTimeout(() => useTourStore.getState().start(), 900);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure card height after each render so positioning stays accurate
  useEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  });

  // Locate the target element (retries until it appears with valid dimensions)
  const findTarget = useCallback(() => {
    if (!active) { setRect(null); return; }
    const target = STEPS[step]?.target;
    if (!target) return;

    setRect(null);
    let attempts = 0;
    let timerId: ReturnType<typeof setTimeout>;

    function tryFind() {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 20 && r.height > 20) {
          setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
          return;
        }
      }
      if (++attempts < 20) timerId = setTimeout(tryFind, 100);
    }

    timerId = setTimeout(tryFind, 80);
    return () => clearTimeout(timerId);
  }, [active, step]);

  useEffect(() => {
    const cleanup = findTarget();
    const onResize = () => findTarget();
    window.addEventListener("resize", onResize);
    return () => { cleanup?.(); window.removeEventListener("resize", onResize); };
  }, [findTarget]);

  if (!active) return null;

  const s  = STEPS[step];
  const hasSpot = rect !== null;

  // Spotlight box (with padding)
  const sx = hasSpot ? rect!.x - PAD : 0;
  const sy = hasSpot ? rect!.y - PAD : 0;
  const sw = hasSpot ? rect!.width  + PAD * 2 : 0;
  const sh = hasSpot ? rect!.height + PAD * 2 : 0;

  const tooltipPos = hasSpot
    ? getTooltipPos(rect!, cardH)
    : { x: (window.innerWidth - CARD_W) / 2, y: (window.innerHeight - cardH) / 2 };

  return (
    <div className="fixed inset-0 z-[80]" style={{ pointerEvents: "all" }}>

      {/* ── SVG backdrop + spotlight cutout ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-cutout">
            <rect width="100%" height="100%" fill="white" />
            {hasSpot && (
              <motion.rect
                animate={{ x: sx, y: sy, width: sw, height: sh }}
                transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                rx={14}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Dark overlay */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.72)"
          mask="url(#tour-cutout)"
        />

        {/* Accent ring around spotlight */}
        {hasSpot && (
          <motion.rect
            animate={{ x: sx, y: sy, width: sw, height: sh }}
            transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            rx={14}
            fill="none"
            stroke="rgba(116,160,255,0.45)"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* ── Tooltip card ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={cardRef}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{   opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bg-no-panel border border-no-border rounded-2xl overflow-hidden"
          style={{
            left:      tooltipPos.x,
            top:       tooltipPos.y,
            width:     CARD_W,
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Step progress dots */}
          <div className="flex gap-1.5 px-5 pt-4">
            {Array.from({ length: TOUR_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-[2px] flex-1 rounded-full transition-all duration-400 ${
                  i < step  ? "bg-no-blue"
                  : i === step ? "bg-no-blue/60"
                  : "bg-no-border"
                }`}
              />
            ))}
          </div>

          {/* Body */}
          <div className="px-5 pt-3.5 pb-5">
            <div className="text-no-text font-semibold text-[15px] leading-snug mb-0.5">
              {s.title}
            </div>
            <div className="text-no-muted/60 text-[10px] uppercase tracking-[0.12em] mb-3">
              Step {step + 1} of {TOUR_STEPS}
            </div>
            <div className="text-no-muted text-[13px] leading-relaxed mb-5">
              {s.body}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={skip}
                className="text-no-muted/45 hover:text-no-muted text-[12px] transition-colors"
              >
                Skip tour
              </button>
              <button
                onClick={next}
                className="bg-no-blue hover:bg-no-blue-dim text-no-blue-fg text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {s.cta}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
