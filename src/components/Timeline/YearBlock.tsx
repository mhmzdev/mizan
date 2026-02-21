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
  const isLabel = year % labelInterval === 0;
  const isMajorTick = isLabel;

  const showLabel = isLabel;
  const tickHeight = isMajorTick ? 16 : 8;

  const fontSize = pxPerYear >= 100 ? 13 : pxPerYear >= 10 ? 12 : 11;

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
            fontSize,
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
