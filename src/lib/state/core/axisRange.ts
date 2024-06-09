import {
  WritableSignal,
  derived,
  mutDerived,
  type Signal,
} from "@mod.js/signals";
import { type TraceList } from "../../index.js";
import {
  rangesHaveMeaningfulIntersection,
  type Range,
  type NumericRange,
  type ResolvedType,
} from "../../types.js";
import { toNumeric, toRange, unitOf } from "../../utils/unit.js";
import { addMarginsToRange } from "../../utils/rangeMargins.js";
import type { RangeMarginValue } from "./axis.js";

export type XAxisRangeProps = {
  resetAllRanges: () => void;
  visibleTraces$: Signal<TraceList>;
  showZero$: Signal<boolean>;
  margins$: Signal<[RangeMarginValue, RangeMarginValue]>;
  commonRange$: WritableSignal<Range | undefined>;
  doUseCommonRange$: Signal<boolean>;
  lengthInPx$: Signal<number | undefined>;
};
export type YAxisRangeProps = ResolvedType<
  {
    autoscale$: Signal<boolean>;
    xRange$: Signal<Range>;
  } & Omit<XAxisRangeProps, "commonRange$" | "doUseCommonRange$">
>;

export interface AxisRange {
  range$: Signal<Range>;
  resetRange: () => void;
  zoomRange: (fractionalRange: NumericRange) => void;
  shiftRange: (fractionalShift: number) => void;
}
export const xAxisRange$ = ({
  resetAllRanges,
  visibleTraces$,
  showZero$,
  margins$,
  commonRange$,
  doUseCommonRange$,
  lengthInPx$,
}: XAxisRangeProps): AxisRange => {
  const tracesRange$ = derived(($) => $(visibleTraces$).range);
  const defaultRange$ = derived(($) => {
    const rangeWithMargins = preventEmptyRange(
      addMarginsToRange($(tracesRange$), $(margins$), $(lengthInPx$)), // FIXME is this the best idea?
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
    if ($(commonRange$) !== undefined && $(doUseCommonRange$))
      return $(commonRange$) as Range;

    if (isAutozoomed || prev === undefined) {
      return def;
    }

    if (!rangesHaveMeaningfulIntersection(def, prev)) {
      resetAllRanges();
      return def;
    }

    return prev;
  });

  const shouldUpdateCommon = () =>
    doUseCommonRange$.get() && commonRange$.get() !== undefined;
  const resetRange = () => {
    isAutozoomed = true;
    range$.set(defaultRange$.get());
    if (shouldUpdateCommon()) commonRange$.set(range$.get());
  };

  const zoomRange = (r: NumericRange) => {
    isAutozoomed = false;
    range$.set(computeZoomedRange(range$.get(), r));
    if (shouldUpdateCommon()) commonRange$.set(range$.get());
  };

  const shiftRange = (s: number) => {
    isAutozoomed = false;
    range$.set(computeShiftedRange(range$.get(), s));
    if (shouldUpdateCommon()) commonRange$.set(range$.get());
  };

  return { range$: range$.toReadonly(), resetRange, zoomRange, shiftRange };
};

export const yAxisRange$ = ({
  resetAllRanges,
  visibleTraces$,
  showZero$,
  autoscale$,
  margins$,
  lengthInPx$,
  xRange$,
}: YAxisRangeProps): AxisRange => {
  const tracesRange$ = derived(($) => $(visibleTraces$).getYRange());
  const defaultRange$ = derived(($) => {
    const rangeWithMargins = preventEmptyRange(
      addMarginsToRange($(tracesRange$), $(margins$), $(lengthInPx$)),
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
    if ($(autoscale$)) {
      return preventEmptyRange(
        addMarginsToRange(
          $(visibleTraces$).getYRange($(xRange$)),
          $(margins$),
          $(lengthInPx$),
        ),
      );
    }
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

  const zoomRange = (r: NumericRange) => {
    if (autoscale$.get()) {
      console.warn("Tried to change the yRange when autoscale is active");
      return;
    }
    isAutozoomed = false;
    range$.set(computeZoomedRange(range$.get(), r));
  };

  const shiftRange = (s: number) => {
    if (autoscale$.get()) {
      console.warn("Tried to change the yRange when autoscale is active");
      return;
    }
    isAutozoomed = false;
    range$.set(computeShiftedRange(range$.get(), s));
  };

  return { range$: range$.toReadonly(), resetRange, zoomRange, shiftRange };
};

const preventEmptyRange = (currentRange: Range) => {
  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  if (from === to) return toRange({ from: from - 1, to: to + 1 }, unit);
  return currentRange;
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
