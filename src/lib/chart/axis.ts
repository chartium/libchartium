import { cons, type Signal } from "@mod.js/signals";
import { NumericDateFormat, type TraceList } from "../index.js";
import {
  Quantity,
  type NumericRange,
  type Range,
  type Unit,
  type Tick,
} from "../types.js";
import { axisUnits$ } from "./axisUnits.js";
import { axisRange$ } from "./axisRange.js";
import { axisTicks$, type TextMeasuringFunction } from "./axisTicks.js";

export type DataUnit = NumericDateFormat | Unit | undefined;
export type DisplayUnit = Unit | undefined;
export type DisplayUnitPreference = DisplayUnit | "auto" | "data";

export interface UnitChangeAction {
  unit: Unit;
  callback(): void;
}

export type RangeMarginValue =
  | { percent: number }
  | { value: number | Quantity }
  | { px: number }
  | 0;

export interface AxisProps {
  axis: "x" | "y";
  resetAllRanges: () => void;
  visibleTraces$: Signal<TraceList>;
  displayUnitPreference$: Signal<DisplayUnitPreference>;
  showZero$: Signal<boolean>;
  measureTextSize$: Signal<TextMeasuringFunction | undefined>;
  lengthInPx$: Signal<number>;
}

export interface Axis {
  range$: Signal<Range>;
  resetRange: () => void;
  shiftRange: (fractionalShift: number) => void;
  zoomRange: (fractionalRange: NumericRange) => void;

  currentDisplayUnit$: Signal<DisplayUnit>;
  unitChangeActions$: Signal<{
    raise?: UnitChangeAction;
    reset?: UnitChangeAction;
    lower?: UnitChangeAction;
  }>;

  ticks$: Signal<Tick[]>;
}

export const axis$ = ({
  axis,
  resetAllRanges,
  visibleTraces$,
  displayUnitPreference$,
  showZero$,
  measureTextSize$,
  lengthInPx$,
}: AxisProps): Axis => {
  const { range$, resetRange, shiftRange, zoomRange } = axisRange$({
    axis,
    resetAllRanges,
    visibleTraces$,
    showZero$,
    fractionalMargins$: cons([0, 0]),
  });

  const { currentDisplayUnit$, unitChangeActions$ } = axisUnits$({
    axis,
    range$,
    visibleTraces$,
    displayUnitPreference$,
  });

  const { ticks$ } = axisTicks$({
    range$,
    currentDisplayUnit$,
    measureTextSize$,
    lengthInPx$,
  });

  return {
    range$,
    resetRange,
    shiftRange,
    zoomRange,
    currentDisplayUnit$,
    unitChangeActions$,
    ticks$,
  };
};
