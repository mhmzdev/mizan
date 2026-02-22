"use client";

import React from "react";
import { formatYear, getLabelIntervalFromPx } from "@/utils/yearUtils";

interface YearBlockProps {
  year: number;
  pxPerYear: number;
  offsetPx: number;
}

function YearBlockInner({ year, pxPerYear, offsetPx }: YearBlockProps) {
  const labelInterval = getLabelIntervalFromPx(pxPerYear);
  const isLabel      = year % labelInterval === 0;
  const tickHeight   = isLabel ? 14 : 6;
  const fontSize     = pxPerYear >= 100 ? 12 : pxPerYear >= 10 ? 11 : 10;

  return (
    <div
      className="absolute top-0 flex flex-col items-center"
      style={{ left: offsetPx, width: pxPerYear }}
    >
      {/* Tick mark */}
      <div
        className="bg-no-border"
        style={{ width: 1, height: tickHeight, opacity: isLabel ? 0.7 : 0.35 }}
      />

      {/* Year label */}
      {isLabel && (
        <span
          className="text-no-muted/70 select-none whitespace-nowrap font-mono"
          style={{ fontSize, marginTop: 3 }}
        >
          {formatYear(year)}
        </span>
      )}
    </div>
  );
}

export const YearBlock = React.memo(YearBlockInner);
