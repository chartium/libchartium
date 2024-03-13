import { cons, derived, mut, type Signal } from "@mod.js/signals";
import { NumericDateFormat, type TraceList } from "../index.js";
import { Quantity, type Range, type Unit } from "../types.js";
import { axisUnits$ } from "./axisUnits.js";
import { axisRange$ } from "./axisRange.js";

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
}

export const axisState = ({
  axis,
  resetAllRanges,
  traces$,
  displayUnitPreference$,
  showZero$,
  textSize$,
}: AxisProps) => {
  const dataUnit$ = derived(($) => $(traces$).getUnits()?.[0][axis]);

  const { range$ } = axisRange$({
    axis,
    resetAllRanges,
    traces$,
    dataUnit$,
    showZero$,
    fractionalMargins$: cons([0, 0]),
  });

  const { currentDisplayUnit$, unitChangeActions$ } = axisUnits$({
    axis,
    range$,
    dataUnit$,
    displayUnitPreference$,
  });
};
