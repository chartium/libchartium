import type { DateRange } from "../types.js";
import { dayjs } from "./dayjs.js";

const periodsFromLargest = <const>[
  "years",
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];
export type Period = (typeof periodsFromLargest)[number];

export function getSmallerPeriod(era: Period): Period {
  let index = periodsFromLargest.findIndex((val) => val === era);
  index = index === -1 ? 0 : index;
  return periodsFromLargest[index + 1] ?? periodsFromLargest.at(-1)!;
}

export type PeriodFormattingString = [
  thisPeriod: string,
  largerPeriod: string | undefined,
];
export type FormattingStrings = {
  [period in Period]: PeriodFormattingString;
};

export class DateFormat {
  constructor(
    /** if the range spans this many (for instance) days or fewer, it will return "hours" instead of "days" */
    public readonly shortWindow = 1.5,
    public readonly formattingStrings: FormattingStrings = {
      years: ["YYYY", undefined],
      months: ["MMM", "YYYY"],
      days: ["MMM D", "YYYY"],
      hours: ["HH:mm", "MMM D YYYY"],
      minutes: ["HH:mm", "MMM D YYYY"],
      seconds: ["HH:mm:ss", "MMM D YYYY"],
      milliseconds: ["HH:mm:ss.SSS", "MMM D YYYY"],
    },
    public readonly timezone: "utc" | "local" = "utc",
  ) {
    Object.freeze(this);
  }

  getPeriodOfRange(range: DateRange): Period {
    const from = dayjs(range.from);
    const to = dayjs(range.to);

    for (const era of periodsFromLargest) {
      if (to.diff(from, era) > this.shortWindow) return era;
    }
    return periodsFromLargest.at(-1)!;
  }

  /**
   * Formats a date with regards to an era
   * @example formatInEra(new Date(2020, 0, 1), "days") === "Jan 1"
   * @example formatInEra(new Date(2020, 0, 1), "hours") === "00:00"
   */
  formatInPeriod(date: dayjs.Dayjs | Date, period: Period): string {
    date = dayjs(date);

    const fmt = this.formattingStrings[period][0];

    return date.format(fmt);
  }

  /**
   * Returns a string that represents the larger period than input units,
   * or undefined if the larger period shoud not be displayed.
   * @example getLargerEra(new Date(2020, 0, 1), "days") === "Jan 2020"
   */
  formatInLargerPeriod(
    date: dayjs.Dayjs | Date,
    period: Period,
  ): string | undefined {
    date = dayjs(date);

    const fmt = this.formattingStrings[period][1];
    if (fmt === undefined) return undefined;

    return date.format(fmt);
  }

  static Default = new DateFormat();
}

/**
 * just like dayjs.get() but returns a float
 * @example getFloatDayjsValue(dayjs(new Date(2001, 9, 11)), "month") // 9.333333333333334 because 10/30 is 0.33
 */
export function getFloatDayjsValue(date: dayjs.Dayjs, unit: Period): number {
  const start = date.startOf(unit);
  const fract = date.diff(start, unit, true);

  return start.get(unit === "days" ? "date" : unit) + fract;
}
