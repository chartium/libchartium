import { Signal, WritableSignal } from "@mod.js/signals";
import { type TraceList } from "../../mod.js";
import {
  Quantity,
  type NumericRange,
  type ChartRange,
  type Tick,
  type DisplayUnitPreference,
  type DisplayUnit,
  type DataUnit,
  type ResolvedType,
} from "../../types.js";
import { axisUnits$ } from "./axisUnits.js";
import { axisTicks$, type TextMeasuringFunction } from "./axisTicks.js";
import { xAxisRange$, yAxisRange$ } from "./axisRange.js";
import type { ExplicitRangeMargins } from "../../utils/rangeMargins.js";

export interface UnitChangeAction {
  unit: DisplayUnit;
  callback(): void;
}

export type UnitChangeActions = {
  raise?: UnitChangeAction;
  reset?: UnitChangeAction;
  lower?: UnitChangeAction;
  bestFit?: UnitChangeAction;
};

export type RangeMarginValue =
  | { percent: number }
  | { value: number | Quantity }
  | { px: number }
  | 0;

export type AxisProps = ResolvedType<XAxisProps | YAxisProps>;

export type XAxisProps = {
  axis: "x";
  resetAllRanges: () => void;
  visibleTraces$: Signal<TraceList>;
  displayUnitPreference$: Signal<DisplayUnitPreference>;
  showZero$: Signal<boolean>;
  measureTextSize$: Signal<TextMeasuringFunction | undefined>;
  lengthInPx$: Signal<number | undefined>;
  commonRange$: WritableSignal<ChartRange | undefined>;
  doUseCommonRange$: Signal<boolean>;
  margins$: Signal<ExplicitRangeMargins>;
};
export type YAxisProps = ResolvedType<
  {
    axis: "y";
    xRange$: Signal<ChartRange>;
    autoscale$: Signal<boolean>;
  } & Omit<XAxisProps, "axis" | "commonRange$" | "doUseCommonRange$">
>;

export interface Axis {
  range$: Signal<ChartRange>;
  resetRange: () => void;
  shiftRange: (fractionalShift: number) => void;
  zoomRange: (fractionalRange: NumericRange) => void;

  dataUnit$: Signal<DataUnit>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  unitChangeActions$: Signal<UnitChangeActions>;

  ticks$: Signal<Tick[]>;
  tickDecimalPlaces$: Signal<number>;
}

export const yAxis$ = ({
  axis,
  resetAllRanges,
  visibleTraces$,
  displayUnitPreference$,
  showZero$,
  measureTextSize$,
  lengthInPx$,
  autoscale$,
  margins$,
  xRange$,
}: YAxisProps): Axis => {
  const { range$, resetRange, shiftRange, zoomRange } = yAxisRange$({
    resetAllRanges,
    showZero$: showZero$.skipEqual(),
    visibleTraces$,
    margins$: margins$.map((m) => [m.bottom ?? 0, m.top ?? 0]),
    lengthInPx$,
    autoscale$,
    xRange$,
  });
  const {
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
    tickDecimalPlaces$,
  } = axisCommon(range$, {
    axis,
    displayUnitPreference$: displayUnitPreference$.skipEqual(),
    lengthInPx$,
    measureTextSize$,
    visibleTraces$,
  });

  return {
    range$,
    resetRange,
    shiftRange,
    zoomRange,
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
    tickDecimalPlaces$,
  };
};

export const xAxis$ = ({
  axis,
  resetAllRanges,
  visibleTraces$,
  displayUnitPreference$,
  showZero$,
  measureTextSize$,
  lengthInPx$,
  commonRange$,
  doUseCommonRange$,
  margins$,
}: XAxisProps): Axis => {
  //displayUnitPreference$: axisProps.displayUnitPreference$.skipEqual(),
  //showZero$: axisProps.showZero$.skipEqual(),
  //autoscale$: axisProps.autoscale$.skipEqual(),
  const { range$, resetRange, shiftRange, zoomRange } = xAxisRange$({
    resetAllRanges,
    commonRange$,
    showZero$: showZero$.skipEqual(),
    visibleTraces$,
    margins$: margins$.map((m) => [m.left ?? 0, m.right ?? 0]),
    lengthInPx$,
    doUseCommonRange$,
  });
  const {
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
    tickDecimalPlaces$,
  } = axisCommon(range$, {
    axis,
    displayUnitPreference$: displayUnitPreference$.skipEqual(),
    lengthInPx$,
    measureTextSize$,
    visibleTraces$,
  });

  return {
    range$,
    resetRange,
    shiftRange,
    zoomRange,
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
    tickDecimalPlaces$,
  };
};

const axisCommon = (
  range$: Signal<ChartRange>,
  {
    axis,
    measureTextSize$,
    lengthInPx$,
    visibleTraces$,
    displayUnitPreference$,
  }: Pick<
    AxisProps,
    | "axis"
    | "measureTextSize$"
    | "lengthInPx$"
    | "visibleTraces$"
    | "displayUnitPreference$"
  >,
) => {
  const { dataUnit$, currentDisplayUnit$, unitChangeActions$ } = axisUnits$({
    displayUnitPreference$,
    range$,
    axis,
    visibleTraces$,
  });

  const { ticks$, decimalPlaces$ } = axisTicks$({
    range$,
    currentDisplayUnit$,
    measureTextSize$,
    lengthInPx$,
  });
  return {
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
    tickDecimalPlaces$: decimalPlaces$,
  };
};
