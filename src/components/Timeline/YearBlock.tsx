"use client";

import React from "react";
import { ZoomMode } from "@/types";
import { PX_PER_YEAR } from "@/utils/constants";
import { formatYear, getLabelInterval } from "@/utils/yearUtils";

interface YearBlockProps {
  year: number;
  mode: ZoomMode;
  offsetPx: number;
}

function YearBlockInner({ year, mode, offsetPx }: YearBlockProps) {
  const pxPerYear = PX_PER_YEAR[mode];
  const labelInterval = getLabelInterval(mode);
  const isLabel = year % labelInterval === 0;
  const isMajorTick = isLabel;

  // In year mode, every year gets a label. In decades/centuries, only at intervals.
  const showLabel = isLabel;
  const tickHeight = isMajorTick ? 16 : 8;

  return (
    <div
      className="absolute top-0 flex flex-col items-center"
      style={{
        left: offsetPx,
        width: pxPerYear,
      }}
    >
      {/* Tick mark */}
      <div
        className="bg-white/60"
        style={{
          width: 1,
          height: tickHeight,
        }}
      />

      {/* Label */}
      {showLabel && (
        <span
          className="text-white/80 select-none whitespace-nowrap font-mono"
          style={{
            fontSize: mode === "years" ? 13 : mode === "decades" ? 12 : 11,
            marginTop: 4,
          }}
        >
          {formatYear(year)}
        </span>
      )}
    </div>
  );
}

export const YearBlock = React.memo(YearBlockInner);
