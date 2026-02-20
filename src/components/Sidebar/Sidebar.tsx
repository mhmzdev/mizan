"use client";

import React, { useState, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { ModeButton } from "./ModeButton";
import { formatYear, yearToPx } from "@/utils/yearUtils";
import { ZoomMode } from "@/types";
import { ZoomIn, ZoomOut, Compass } from "lucide-react";

const modes: { mode: ZoomMode; label: string; icon: React.ReactNode }[] = [
  { mode: "centuries", label: "Centuries", icon: <ZoomOut size={14} /> },
  { mode: "decades", label: "Decades", icon: <Compass size={14} /> },
  { mode: "years", label: "Years", icon: <ZoomIn size={14} /> },
];

export function Sidebar() {
  const currentMode = useTimelineStore((s) => s.mode);
  const centerYear = useTimelineStore((s) => s.centerYear);
  const setMode = useTimelineStore((s) => s.setMode);

  const [jumpInput, setJumpInput] = useState("");

  const handleJump = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = jumpInput.trim().toUpperCase();
      let year: number;

      if (trimmed.endsWith("BC")) {
        const num = parseInt(trimmed.replace("BC", "").trim());
        if (isNaN(num)) return;
        year = -num; // e.g., "500 BC" → -500
      } else if (trimmed.endsWith("AD")) {
        const num = parseInt(trimmed.replace("AD", "").trim());
        if (isNaN(num)) return;
        year = num - 1; // e.g., "500 AD" → 499 (internal)
      } else {
        const num = parseInt(trimmed);
        if (isNaN(num)) return;
        year = num > 0 ? num - 1 : -num; // positive → AD, negative → BC
      }

      // Clamp
      year = Math.max(-4000, Math.min(2025, year));

      const state = useTimelineStore.getState();
      const mode = state.mode;
      const vw = state.viewportWidth;
      const newScrollLeft = yearToPx(year, mode) - vw / 2;
      useTimelineStore.setState({
        scrollLeft: Math.max(0, newScrollLeft),
        centerYear: year,
      });

      // Sync DOM
      const container = document.querySelector(".timeline-scroll");
      if (container) {
        container.scrollLeft = Math.max(0, newScrollLeft);
      }

      setJumpInput("");
    },
    [jumpInput]
  );

  return (
    <aside className="w-52 bg-zinc-950 border-l border-white/15 flex flex-col p-4 gap-5 shrink-0">
      {/* Center year display */}
      <div className="text-center">
        <div className="text-white/50 text-[11px] uppercase tracking-widest mb-1">
          Center
        </div>
        <div className="text-white text-2xl font-mono font-semibold">
          {formatYear(centerYear)}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-white/15" />

      {/* Mode selector */}
      <div>
        <div className="text-white/50 text-[11px] uppercase tracking-widest mb-2.5">
          Scale
        </div>
        <div className="flex flex-col gap-1.5">
          {modes.map(({ mode, label, icon }) => (
            <ModeButton
              key={mode}
              label={label}
              mode={mode}
              active={currentMode === mode}
              onClick={() => setMode(mode)}
            />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-white/15" />

      {/* Jump to year */}
      <div>
        <div className="text-white/50 text-[11px] uppercase tracking-widest mb-2.5">
          Jump to Year
        </div>
        <form onSubmit={handleJump} className="flex flex-col gap-2">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="e.g. 500 BC"
            className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-md px-3 py-2 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-auto">
        <div className="text-white/30 text-[11px] space-y-1">
          <p>Scroll: Mouse wheel / trackpad</p>
          <p>1/2/3: Switch modes</p>
        </div>
      </div>
    </aside>
  );
}
