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
import { axisTicks$ } from "./axisTicks.js";

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
  traces$: Signal<TraceList>;
  displayUnitPreference$: Signal<DisplayUnitPreference>;
  showZero$: Signal<boolean>;
  textSize$: Signal<(text: string) => number>;
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
  traces$,
  displayUnitPreference$,
  showZero$,
  textSize$,
  lengthInPx$,
}: AxisProps): Axis => {
  const { range$, resetRange, shiftRange, zoomRange } = axisRange$({
    axis,
    resetAllRanges,
    traces$,
    showZero$,
    fractionalMargins$: cons([0, 0]),
  });

  const { currentDisplayUnit$, unitChangeActions$ } = axisUnits$({
    axis,
    range$,
    traces$,
    displayUnitPreference$,
  });

  const { ticks$ } = axisTicks$({
    range$,
    currentDisplayUnit$,
    textSize$,
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
