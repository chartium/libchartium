import type { Dayjs } from "dayjs";
import type { Quantity, Range, Size, Unit } from "../types.js";
import {
  add,
  divide,
  multiply,
  subtract,
  toNumeric,
  toQuantOrDay,
} from "./quantityHelpers.js";
import type { NumericDateFormat } from "./numericDateFormat.js";

export type RangeMarginValue =
  | { percent: number }
  | { value: number | Quantity }
  | { px: number }
  | 0;

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
  | {
      top?: RangeMarginValue;
      right?: RangeMarginValue;
      bottom?: RangeMarginValue;
      left?: RangeMarginValue;
    };

export const addMarginsToRange = (
  margins: RangeMargins,
  { width, height }: Size,
  xRange: Range,
  yRange: Range,
): { xRange: Range; yRange: Range } => {
  if ("all" in margins)
    margins = {
      top: margins.all,
      right: margins.all,
      bottom: margins.all,
      left: margins.all,
    };

  if ("vertical" in margins || "horizontal" in margins)
    margins = {
      top: margins.vertical,
      right: margins.horizontal,
      bottom: margins.vertical,
      left: margins.horizontal,
    };

  let { top, right, bottom, left } = margins;

  const pxToPercent = (part: number, total: number) => (100 * part) / total;
  const coercePx = (dim: typeof top, total: number) =>
    dim && "px" in dim ? { percent: pxToPercent(dim.px, total) } : dim;

  top = coercePx(top, height);
  right = coercePx(right, width);
  bottom = coercePx(bottom, height);
  left = coercePx(left, width);

  type M = typeof top;
  const expandRange = ({ from, to }: Range, margins: [M, M]): Range => {
    // calculate the new length of the range
    // the absolute margins are simply added to the current length
    // the relative margins are counted as L ↦ L/(1 - Σrᵢ)
    const numerator = margins.reduce(
      (a, b) => (b && "value" in b ? add(a, b.value) : a),
      subtract(to, from),
    ) as number | Quantity;
    const denominator = margins.reduce(
      (a, b) => (b && "percent" in b ? a - b.percent / 100 : a),
      1,
    );
    const newLength = divide(numerator, denominator);

    // convert relative margins to absolute margins
    const absoluteMargins = margins.map((m) =>
      !m ? 0 : "value" in m ? m.value : multiply(newLength, m.percent / 100),
    );

    return {
      from: subtract(from, absoluteMargins[0]),
      to: add(to, absoluteMargins[1]),
    } as Range;
  };

  return {
    xRange: expandRange(xRange, [left, right]),
    yRange: expandRange(yRange, [top, bottom]),
  };
};

export const addZeroToRange = (
  range: Range,
  dataUnit: Unit | NumericDateFormat | undefined,
): Range => {
  const from = toNumeric(range.from, dataUnit);
  const to = toNumeric(range.to, dataUnit);
  return {
    from: toQuantOrDay(Math.min(0, from), dataUnit),
    to: toQuantOrDay(Math.max(0, to), dataUnit),
  } as Range;
};
