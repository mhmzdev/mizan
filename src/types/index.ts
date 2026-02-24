export type ZoomMode = "overview" | "centuries" | "decades" | "years";

export type YearNotation = "BC/AD" | "BCE/CE" | "BH/AH";

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
  /** ID of the other note this note is linked to (bidirectional). */
  linkedNoteId?: number;
  /** WGS-84 latitude (-90 to +90) */
  lat?: number;
  /** WGS-84 longitude (-180 to +180) */
  lng?: number;
  /** Location accuracy in metres, optional metadata */
  locationAccuracy?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEvent {
  id: string;
  year: number; // continuous integer: -4000 to 2025
  title: string;
  description?: string;
  track: "global" | "personal";
  lat?: number;
  lng?: number;
}

export interface Track {
  id: "global" | "personal";
  label: string;
}

export interface VisibleRange {
  startYear: number;
  endYear: number;
}
