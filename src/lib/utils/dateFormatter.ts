import dayjs from "dayjs";
import type { DateRange } from "../types.js";

export type DateRangeSpan =
  | "years"
  | "months"
  | "days"
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds";

/** Returns what biggest eras the range spans
 * @example getRangeSpan({ from: new Date(2020, 0, 1), to: new Date(2020, 0, 2) }) === "days"
 */
export function getRangeSpan(
  range: DateRange,
  shortWindow = 1.5
): DateRangeSpan {
  const from = dayjs(range.from);
  const to = dayjs(range.to);

  if (from.diff(to, "year") > shortWindow) {
    return "years";
  } else if (from.diff(to, "month") > shortWindow) {
    return "months";
  } else if (from.diff(to, "day") > shortWindow) {
    return "days";
  } else if (from.diff(to, "hour") > shortWindow) {
    return "hours";
  } else if (from.diff(to, "minute") > shortWindow) {
    return "minutes";
  } else if (from.diff(to, "second") > shortWindow) {
    return "seconds";
  } else {
    return "milliseconds";
  }
}

/** Returns a string that represents the larger era than input units
 * @example getLargerEra(new Date(2020, 0, 1), "days") === "Jan 2020"
 * returns undefined if the input units are years
 */
export function getLargerEra(
  date: dayjs.Dayjs | Date,
  largerThanUnits: DateRangeSpan
): string | undefined {
  date = dayjs(date);

  switch (largerThanUnits) {
    case "years":
      return undefined;
    case "months":
      return date.format("YYYY");
    case "days":
      return date.format("YYYY");
    default:
      return date.format("MMM D YYYY");
  }
}

/** Formats a date with regards to an era
 * @example formatInEra(new Date(2020, 0, 1), "days") === "Jan 1"
 * @example formatInEra(new Date(2020, 0, 1), "hours") === "00:00"
 */
export function formatInEra(
  date: dayjs.Dayjs | Date,
  era: DateRangeSpan
): string {
  date = dayjs(date);

  switch (era) {
    case "years":
      return date.format("YYYY");
    case "months":
      return date.format("MMM");
    case "days":
      return date.format("MMM D");
    case "hours":
      return date.format("HH:mm");
    case "minutes":
      return date.format("HH:mm");
    case "seconds":
      return date.format("HH:mm:ss");
    default:
      return date.format("HH:mm:ss.SSS");
  }
}
