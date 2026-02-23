import { useSettingsStore } from "@/stores/settingsStore";
import { formatYear } from "@/utils/yearUtils";

/** Returns a year formatter bound to the current notation setting. */
export function useFormatYear(): (year: number) => string {
  const notation = useSettingsStore((s) => s.notation);
  return (year: number) => formatYear(year, notation);
}
