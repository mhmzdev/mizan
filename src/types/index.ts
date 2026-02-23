export type ZoomMode = "overview" | "centuries" | "decades" | "years";

export interface Timeline {
  id?: number;
  title: string;
  /** Ties this timeline to a fixed event track in events.json. Only set on default timelines. */
  eventTrack?: "global" | "personal";
  isDefault: boolean;
  hidden?: boolean;
  createdAt: number;
}

export interface Note {
  id?: number;
  timelineId: number;
  year: number;
  title: string;
  content: string;
  /** Set when this note annotates a global event — hides that event dot on the timeline. */
  sourceEventId?: string;
  createdAt: number;
  updatedAt: number;
}

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
