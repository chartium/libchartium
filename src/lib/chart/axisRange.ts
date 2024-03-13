import { derived, mutDerived, type Signal } from "@mod.js/signals";
import { NumericDateFormat, type TraceList } from "../index.js";
import type { DataUnit, DisplayUnit, RangeMarginValue } from "./axis.js";
import {
  rangesHaveMeaningfulIntersection,
  type Range,
  type Zoom,
  type NumericRange,
  Quantity,
} from "../types.js";
import dayjs, { Dayjs } from "dayjs";
import { toNumeric, toRange } from "../utils/quantityHelpers.js";

export interface AxisRangeProps {
  axis: "x" | "y";
  resetAllRanges: () => void;
  traces$: Signal<TraceList>;
  dataUnit$: Signal<DataUnit>;
  showZero$: Signal<boolean>;
  fractionalMargins$: Signal<[number, number]>;
}

export interface AxisRange {
  range$: Signal<Range>;
  resetRange: () => void;
}

export const axisRange$ = ({
  axis,
  resetAllRanges,
  traces$,
  dataUnit$,
  showZero$,
  fractionalMargins$,
}: AxisRangeProps): AxisRange => {
  const tracesRange$ = derived(($) =>
    axis === "x" ? $(traces$).range : $(traces$).getYRange(),
  );

  const defaultRange$ = derived(($) => {
    const rangeWithMargins = addFractionalMarginsToRange(
      $(tracesRange$),
      $(fractionalMargins$),
    );
    if ($(showZero$)) {
      return addZeroToRange(rangeWithMargins);
    } else {
      return rangeWithMargins;
    }
  });

  let isAutozoomed = true;
  const range$ = mutDerived<Range>(($, { prev }) => {
    const def = $(defaultRange$);

    if (isAutozoomed || prev === undefined) {
      return def;
    }

    if (!rangesHaveMeaningfulIntersection(def, prev)) {
      resetAllRanges();
      return def;
    }

    return prev;
  });

  const resetRange = () => {
    isAutozoomed = true;
    range$.set(defaultRange$.get());
  };

  return { range$: range$.toReadonly(), resetRange };
};

const addFractionalMarginsToRange = (
  currentRange: Range,
  [lower, higher]: [number, number],
) => {
  /*
    |<--------------100%--------------->|
    |<--lower-->|<--curr-->|<--higher-->|
  */
  if (lower + higher >= 1) {
    throw new Error("The specified margins add up to more than 100%");
  }

  const lengthMultiplier = 1 / (1 - lower - higher);

  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  const newLength = (to - from) * lengthMultiplier;

  return toRange(
    {
      from: from - lower * newLength,
      to: to + higher * newLength,
    },
    unit,
  );
};

const addZeroToRange = (range: Range): Range => {
  const unit = unitOf(range.from);
  const from = toNumeric(range.from, unit);
  const to = toNumeric(range.to, unit);
  return toRange(
    {
      from: Math.min(0, from),
      to: Math.max(0, to),
    },
    unit,
  );
};

const computeZoomedRange = (
  currentRange: Range,
  zoomToFractional: NumericRange,
) => {
  const unit = unitOf(currentRange.from);

  const d =
    toNumeric(currentRange.to, unit) - toNumeric(currentRange.from, unit);

  if (zoomToFractional.to - zoomToFractional.from <= 0) return currentRange;

  return toRange(
    {
      from: toNumeric(currentRange.from, unit) + d * zoomToFractional.from,
      to: toNumeric(currentRange.from, unit) + d * zoomToFractional.to,
    },
    unit,
  );
};

const computeShiftedRange = (
  currentRange: Range,
  shiftByFractional: number,
) => {
  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  const delta = (to - from) * -shiftByFractional;
  return toRange(
    {
      from: from + delta,
      to: to + delta,
    },
    unit,
  );
};

const unitOf = (v: number | Dayjs | Quantity): DataUnit =>
  v instanceof Quantity
    ? v.unit
    : dayjs.isDayjs(v)
      ? NumericDateFormat.EpochSeconds
      : undefined;
