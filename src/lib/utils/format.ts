import dayjs from "dayjs";
import { Quantity, type Unit } from "../types.js";
import type { FormatOptions } from "unitlib";
import { tick } from "svelte";
import { NumericDateFormat } from "./numericDateFormat.js";

/** Writes exponential notation that doesnt make your eyes bleed */
export function prettyExp(input: number, decimals: number): string {
  const exp = Math.floor(Math.log10(input));
  const mantissa = input / Math.pow(10, exp);
  return `${mantissa.toFixed(decimals)}×10<sup>${exp}</sup>`;
}

/** checks if all numbers of an array can be uniquely written with fixed decimals */
export function fitsIntoDecimals(arr: number[], numOfDeciamls = 2): boolean {
  const withFixed = arr.map((el) => el.toFixed(numOfDeciamls));
  return (
    withFixed.filter((item, index) => withFixed.indexOf(item) !== index)
      .length === 0
  );
}

/** Returns how many decimals <= maxDecimals are needed
 * to uniquely describe each element of the input array */
export function uniqueDecimals(
  arr: number[],
  maxDecimals: number = 10
): number {
  for (var i = 0; i < maxDecimals; i++) {
    if (fitsIntoDecimals(arr, i)) {
      break;
    }
  }
  return i;
}

/** Measures phisical amount of space text takes up */
export function measureText(
  text: string,
  measuringSpan: HTMLSpanElement,
  direction: "horizontal" | "vertical" = "horizontal"
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
  direction: "horizontal" | "vertical" = "horizontal"
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

/** Formats input based on options */
export function qndFormat(
  input: number | Quantity | dayjs.Dayjs,
  options: {
    decimals?: number;
    dayjsFormat?: string;
    quantityFormat?: FormatOptions;
    unit?: Unit;
  }
) {
  if (typeof input === "number") {
    return input.toFixed(options.decimals ?? 2);
  } else if (input instanceof Quantity) {
    input = input.inUnits(options.unit ?? input.unit);
    return `${input.value.toFixed(
      options.decimals ?? 2
    )} ${input.unit.toString()}`;
    // FIXME fix this once this is implemented in unitlib
    // return input.toString(options.quantityFormat ?? {});
  } else {
    return input.format(options.dayjsFormat ?? "YYYY-MM-DD");
  }
}
