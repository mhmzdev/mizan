export type ZoomMode = "overview" | "centuries" | "decades" | "years";

export interface TimelineEvent {
  id: string;
  year: number; // continuous integer: -4000 to 2025
  title: string;
  description?: string;
  track: "global" | "personal";
}

export interface Track {
  id: "global" | "personal";
  label: string;
}

export interface VisibleRange {
  startYear: number;
  endYear: number;
}
