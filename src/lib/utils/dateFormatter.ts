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

  if (to.diff(from, "year") > shortWindow) {
    return "years";
  } else if (to.diff(from, "month") > shortWindow) {
    return "months";
  } else if (to.diff(from, "day") > shortWindow) {
    return "days";
  } else if (to.diff(from, "hour") > shortWindow) {
    return "hours";
  } else if (to.diff(from, "minute") > shortWindow) {
    return "minutes";
  } else if (to.diff(from, "second") > shortWindow) {
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

/** just like dayjs.get() but returns a float
 * @example getFloatDayjsValue(dayjs(new Date(2001, 9, 11)), "month") // 9.333333333333334 becuase 10/30 is 0.33
 */
export function getFloatDayjsValue(
  date: dayjs.Dayjs,
  unit: DateRangeSpan
): number {
  const start = date.startOf(unit);
  const fract = date.diff(start, unit, true);

  return start.get(unit === "days" ? "date" : unit) + fract;
}

function test() {
  const from = dayjs().subtract(3, "days");
  const to = dayjs();

  console.log(to.diff(from, "days"));

  console.log(getRangeSpan({ from, to }));
}

test();
