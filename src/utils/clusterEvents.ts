import { TimelineEvent } from "@/types";

export interface EventCluster {
  /** Year used to position the dot — midpoint of the first and last event in the group. */
  centerYear: number;
  events: TimelineEvent[];
}

/**
 * Minimum screen-space gap (px) between adjacent cluster dots.
 * At centuries zoom (pxPerYear≈5) this yields ~30-year buckets.
 * At decades zoom (pxPerYear≈50) it yields ~3-year buckets.
 * At years zoom (pxPerYear≈500) buckets are <1 year → effectively no grouping.
 */
const MIN_CLUSTER_PX = 150;

export function clusterEvents(
  events: TimelineEvent[],
  pxPerYear: number,
): EventCluster[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.year - b.year);
  const yearGap = MIN_CLUSTER_PX / pxPerYear;

  const clusters: EventCluster[] = [];
  let group: TimelineEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    // Gap measured from last event in current group to the next event
    if (sorted[i].year - group[group.length - 1].year <= yearGap) {
      group.push(sorted[i]);
    } else {
      clusters.push(toCluster(group));
      group = [sorted[i]];
    }
  }
  clusters.push(toCluster(group));

  return clusters;
}

function toCluster(events: TimelineEvent[]): EventCluster {
  const first = events[0].year;
  const last  = events[events.length - 1].year;
  return { centerYear: Math.round((first + last) / 2), events };
}
