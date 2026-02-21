import { ZoomMode } from "@/types";

export const YEAR_START = -4000;
export const YEAR_END = 2025;
export const TOTAL_YEARS = YEAR_END - YEAR_START + 1; // 6026
export const BUFFER = 5;

export const MIN_PX_PER_YEAR = 3; // ~500 years visible at max zoom-out in a 1500px viewport
export const MAX_PX_PER_YEAR = 500;

export const PX_PER_YEAR: Record<ZoomMode, number> = {
  overview: 0.3,
  centuries: 5,
  decades: 50,
  years: 500,
};
