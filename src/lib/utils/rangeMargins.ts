import type { Quantity, ChartRange, Unit } from "../types.js";
import {
  toNumeric,
  toChartValue,
  toChartRange,
  unitOf,
  toNumericRange,
} from "../units/mod.js";
import { NumericDateRepresentation } from "./numericDateRepresentation.js";
import type { RangeMarginValue } from "../state/core/axis.js";

export type Test = HTMLButtonElement;

export type ExplicitRangeMargins = {
  top?: RangeMarginValue;
  right?: RangeMarginValue;
  bottom?: RangeMarginValue;
  left?: RangeMarginValue;
};

export type RangeMargins =
  | { all: RangeMarginValue }
  | {
      vertical: RangeMarginValue;
      horizontal?: RangeMarginValue;
    }
  | {
      vertical?: RangeMarginValue;
      horizontal: RangeMarginValue;
    }
  | ExplicitRangeMargins;

export function explicifyRangeMargins(
  m: RangeMargins | undefined,
): ExplicitRangeMargins {
  if (m === undefined) return {};
  if ("all" in m)
    return {
      top: m.all,
      bottom: m.all,
      left: m.all,
      right: m.all,
    };
  if ("horizontal" in m || "vertical" in m)
    return {
      top: m.vertical,
      bottom: m.vertical,
      left: m.horizontal,
      right: m.horizontal,
    };
  return m;
}

export function toFractionalMargins(
  currentRange: ChartRange,
  margins: [RangeMarginValue, RangeMarginValue],
  sizeInPX: number | undefined,
): [number, number] {
  const compatibleUnit = unitOf(currentRange.from);
  const numericRange = toNumericRange(currentRange, compatibleUnit);
  const rangeWidth = numericRange.to - numericRange.from;
  if (margins.every((v) => v !== 0 && "value" in v)) {
    const numericMargins = margins.map((m) =>
      toNumeric((m as { value: number | Quantity }).value, compatibleUnit),
    );
    return numericMargins.map(
      (m) => m / (rangeWidth + numericMargins[0] + numericMargins[1]),
    ) as [number, number];
  }

  const nonQuantIndex = margins.findIndex((m) => m === 0 || !("value" in m));
  const maybeQuantIdex = Number(!nonQuantIndex);

  const nonQuant = (() => {
    const margin = margins[nonQuantIndex];
    if (margin === 0) return 0;
    if ("percent" in margin) return margin.percent / 100;
    if ("px" in margin)
      return sizeInPX === undefined ? 0 : margin.px / sizeInPX;
  })() as number;

  const maybeQuant = (() => {
    const margin = margins[maybeQuantIdex];
    if (margin === 0) return 0;
    if ("percent" in margin) return margin.percent / 100;
    if ("px" in margin)
      return sizeInPX === undefined ? 0 : margin.px / sizeInPX;
    // ("value" in margin)
    const numericMargin = toNumeric(margin.value, compatibleUnit);
    return numericMargin * ((1 - nonQuant) / (numericMargin + rangeWidth));
  })();
  const res = [];
  res[nonQuantIndex] = nonQuant;
  res[maybeQuantIdex] = maybeQuant;
  return res as [number, number];
}

export const addFractionalMarginsToRange = (
  currentRange: ChartRange,
  [lower, higher]: [number, number],
) => {
  /*
    |<--------------100%--------------->|
    |<--lower-->|<--curr-->|<--higher-->|
  */

  const lengthMultiplier = 1 / (1 - lower - higher);

  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  const newLength = (to - from) * lengthMultiplier;

  return toChartRange(
    {
      from: from - lower * newLength,
      to: to + higher * newLength,
    },
    unit,
  );
};

export const addMarginsToRange = (
  currentRange: ChartRange,
  margins: [RangeMarginValue, RangeMarginValue],
  lengthInPx: number | undefined,
) => {
  let fractional = toFractionalMargins(currentRange, margins, lengthInPx);
  if (lengthInPx !== undefined && fractional[0] + fractional[1] >= 1) {
    console.warn("The specified margins add up to more than 100%");
    fractional = [0.49, 0.49];
  }
  return addFractionalMarginsToRange(currentRange, fractional);
};

export const addZeroToRange = (
  range: ChartRange,
  dataUnit: Unit | NumericDateRepresentation | undefined,
): ChartRange => {
  const from = toNumeric(range.from, dataUnit);
  const to = toNumeric(range.to, dataUnit);
  return {
    from: toChartValue(Math.min(0, from), dataUnit),
    to: toChartValue(Math.max(0, to), dataUnit),
  } as ChartRange;
};
