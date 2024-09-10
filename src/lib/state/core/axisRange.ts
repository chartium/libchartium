import {
  WritableSignal,
  derived,
  mutDerived,
  type Signal,
} from "@typek/signalhead";
import { type TraceList } from "../../mod.js";
import {
  rangesHaveMeaningfulIntersection,
  type ChartRange,
  type NumericRange,
  isSameRange,
} from "../../types.js";
import { toNumeric, toChartRange, unitOf } from "../../units/mod.js";
import { addMarginsToRange } from "../../utils/rangeMargins.js";
import type { RangeMarginValue } from "./axis.js";
import type { SimplifyType } from "@typek/typek";

export type XAxisRangeProps = {
  resetAllRanges: () => void;
  visibleTraces$: Signal<TraceList>;
  showZero$: Signal<boolean>;
  margins$: Signal<[RangeMarginValue, RangeMarginValue]>;
  commonRange$: WritableSignal<ChartRange | undefined>;
  doUseCommonRange$: Signal<boolean>;
  lengthInPx$: Signal<number | undefined>;
};
export type YAxisRangeProps = SimplifyType<
  {
    autoscale$: Signal<boolean>;
    xRange$: Signal<ChartRange>;
  } & Omit<XAxisRangeProps, "commonRange$" | "doUseCommonRange$">
>;

export interface AxisRange {
  range$: Signal<ChartRange>;
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
  const tracesRange$ = derived((S) => S(visibleTraces$).range);
  const defaultRange$ = derived((S) => {
    const rangeWithMargins = preventEmptyRange(
      addMarginsToRange(S(tracesRange$), S(margins$), S(lengthInPx$)),
    );
    if (S(showZero$)) {
      return addZeroToRange(rangeWithMargins);
    } else {
      return rangeWithMargins;
    }
  });

  let isAutozoomed = true;
  const range$ = mutDerived<ChartRange>((S, { prev }) => {
    const def = S(defaultRange$);
    if (S(commonRange$) !== undefined && S(doUseCommonRange$))
      return S(commonRange$) as ChartRange;

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
    commonRange$.set(range$.get());
  };

  const zoomRange = (r: NumericRange) => {
    isAutozoomed = false;
    range$.set(computeZoomedRange(range$.get(), r));
    commonRange$.set(range$.get());
  };

  const shiftRange = (s: number) => {
    isAutozoomed = false;
    range$.set(computeShiftedRange(range$.get(), s));
    commonRange$.set(range$.get());
  };

  return {
    range$: range$
      .toReadonly()
      .skip(
        (v, { prev }) => prev === undefined || isSameRange(v, prev),
        range$.get(),
      ),
    resetRange,
    zoomRange,
    shiftRange,
  };
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
  const tracesRange$ = derived((S) => S(visibleTraces$).getYRange());
  const defaultRange$ = derived((S) => {
    const rangeWithMargins = preventEmptyRange(
      addMarginsToRange(S(tracesRange$), S(margins$), S(lengthInPx$)),
    );
    if (S(showZero$)) {
      return addZeroToRange(rangeWithMargins);
    } else {
      return rangeWithMargins;
    }
  });

  let isAutozoomed = true;
  const range$ = mutDerived<ChartRange>((S, { prev }) => {
    const def = S(defaultRange$);
    if (S(autoscale$)) {
      return preventEmptyRange(
        addMarginsToRange(
          S(visibleTraces$).getYRange(S(xRange$), false),
          S(margins$),
          S(lengthInPx$),
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

const preventEmptyRange = (currentRange: ChartRange) => {
  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  if (from === to) return toChartRange({ from: from - 1, to: to + 1 }, unit);
  return currentRange;
};

const addZeroToRange = (range: ChartRange): ChartRange => {
  const unit = unitOf(range.from);
  const from = toNumeric(range.from, unit);
  const to = toNumeric(range.to, unit);
  return toChartRange(
    {
      from: Math.min(0, from),
      to: Math.max(0, to),
    },
    unit,
  );
};

const computeZoomedRange = (
  currentRange: ChartRange,
  zoomToFractional: NumericRange,
) => {
  const unit = unitOf(currentRange.from);

  const d =
    toNumeric(currentRange.to, unit) - toNumeric(currentRange.from, unit);

  if (zoomToFractional.to - zoomToFractional.from <= 0) return currentRange;

  return toChartRange(
    {
      from: toNumeric(currentRange.from, unit) + d * zoomToFractional.from,
      to: toNumeric(currentRange.from, unit) + d * zoomToFractional.to,
    },
    unit,
  );
};

const computeShiftedRange = (
  currentRange: ChartRange,
  shiftByFractional: number,
) => {
  const unit = unitOf(currentRange.from);
  const from = toNumeric(currentRange.from, unit);
  const to = toNumeric(currentRange.to, unit);

  const delta = (to - from) * -shiftByFractional;
  return toChartRange(
    {
      from: from + delta,
      to: to + delta,
    },
    unit,
  );
};
