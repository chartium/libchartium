import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
import { Quantity, type Unit } from "../types.js";
import { formatFloat, type QuantityFormatOptions } from "unitlib";
/** Writes exponential notation that doesn't make your eyes bleed */
export function prettyExp(input: number, decimals: number): string {
  const exp = Math.floor(Math.log10(input));
  const mantissa = input / Math.pow(10, exp);
  return `${mantissa.toFixed(decimals)}×10<sup>${exp}</sup>`;
}

/** checks if all numbers of an array can be uniquely written with fixed decimals */
export function fitsIntoDecimals(arr: number[], numOfDecimals = 2): boolean {
  const withFixed = arr.map((el) => el.toFixed(numOfDecimals));
  return (
    withFixed.filter((item, index) => withFixed.indexOf(item) !== index)
      .length === 0
  );
}

/** Returns how many decimals <= maxDecimals are needed
 * to uniquely describe each element of the input array */
export function uniqueDecimals(
  arr: number[],
  maxDecimals: number = 10,
): number {
  let i = 0;
  for (; i < maxDecimals; i++) {
    if (fitsIntoDecimals(arr, i)) {
      break;
    }
  }
  return i;
}

/** Measures physical amount of space text takes up */
export function measureText(
  text: string,
  measuringSpan: HTMLSpanElement,
  direction: "horizontal" | "vertical" = "horizontal",
): number {
  measuringSpan.innerHTML = text;
  return direction === "horizontal"
    ? measuringSpan.getBoundingClientRect().width
    : measuringSpan.getBoundingClientRect().height;
}

/**
 * Checks if the content (ticks) overlaps within the available space.
 * @param content - An array of objects containing the value and position of each tick.
 * @param measuringSpan - A span element used to measure the width of the text.
 */
export function doOverlap(
  content: { text: string; position: number }[],
  measuringSpan: HTMLSpanElement,
  direction: "horizontal" | "vertical" = "horizontal",
): boolean {
  for (let i = 0; i < content.length - 1; i++) {
    const thisTick = content[i];
    const nextTick = content[i + 1];
    const distance = nextTick.position - thisTick.position;
    const textLength =
      measureText(thisTick.text, measuringSpan, direction) / 2 +
      measureText(nextTick.text, measuringSpan, direction) / 2;
    if (distance < textLength + 4) {
      return true;
    }
  }

  return false;
}

export interface QndFormatOptions extends QuantityFormatOptions {
  dateFormat?: string;
  unit?: Unit;
}

/** Formats input based on options */
export function qndFormat(
  input: number | Quantity | dayjs.Dayjs,
  options: QndFormatOptions = {},
) {
  options = { ...options };
  options.decimalPlaces ??= 2;
  options.digitGroupLength ??= 3;
  options.fancyUnicode ??= true;

  if (typeof input === "number") {
    if (isNaN(input)) return "—";
    return formatFloat(input, options);
  } else if (input instanceof Quantity) {
    if (isNaN(input.value)) return "—";
    if (options.unit) {
      try {
        input = input.inUnits(options.unit);
      } catch {}
    }
    return input.toString(options);
  } else {
    return input.utc().format(options.dateFormat ?? "YYYY-MM-DD");
  }
}
