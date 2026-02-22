"use client";

import React from "react";
import { formatYear, getLabelIntervalFromPx } from "@/utils/yearUtils";
import { alphaColor } from "@/utils/timelineColors";

interface YearBlockProps {
  year: number;
  pxPerYear: number;
  offsetPx: number;
  isActive?: boolean;
  tickColor?: string;
}

function YearBlockInner({ year, pxPerYear, offsetPx, isActive, tickColor }: YearBlockProps) {
  const labelInterval = getLabelIntervalFromPx(pxPerYear);
  const isLabel      = year % labelInterval === 0;
  const tickHeight   = isLabel ? 14 : 6;
  const fontSize     = pxPerYear >= 100 ? 14 : 12;

  const tickStyle = isActive && tickColor
    ? {
        width: 1,
        height: tickHeight,
        opacity: isLabel ? 0.9 : 0.55,
        background: tickColor,
        boxShadow: isLabel
          ? `0 0 6px 2px ${alphaColor(tickColor, 40)}`
          : `0 0 4px 1px ${alphaColor(tickColor, 27)}`,
      }
    : { width: 1, height: tickHeight, opacity: isLabel ? 0.7 : 0.35 };

  return (
    <div
      className="absolute top-0 flex flex-col items-center"
      style={{ left: offsetPx, width: pxPerYear }}
    >
      {/* Tick mark */}
      <div
        className={isActive && tickColor ? undefined : "bg-no-border"}
        style={tickStyle}
      />

      {/* Year label */}
      {isLabel && (
        <span
          className="select-none whitespace-nowrap font-mono"
          style={{
            fontSize,
            marginTop: 3,
            color: isActive && tickColor ? alphaColor(tickColor, 80) : undefined,
          }}
        >
          {formatYear(year)}
        </span>
      )}
    </div>
  );
}

export const YearBlock = React.memo(YearBlockInner);
