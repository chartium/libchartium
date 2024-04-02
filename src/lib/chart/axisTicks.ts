import { derived, type Signal } from "@mod.js/signals";
import {
  isDateRange,
  type NumericRange,
  type QuantityRange,
  type Range,
  type Tick,
  type DateRange,
} from "../types.js";
import type { DisplayUnit } from "./axis.js";
import { toNumericRange } from "../utils/quantityHelpers.js";
import { qndFormat, uniqueDecimals } from "../utils/format.js";
import {
  formatInEra,
  getFloatDayjsValue,
  formattedInLargerEra,
  getRangeSpan,
  getSmallerEra,
} from "../utils/dateFormatter.js";
import type dayjs from "dayjs";
import { NumericDateFormat } from "../index.js";

export type TextMeasuringFunction = (text: string) => number;

export interface AxisTicksProps {
  range$: Signal<Range>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  measureTextSize$: Signal<TextMeasuringFunction | undefined>;
  lengthInPx$: Signal<number | undefined>;
}

export interface AxisTicks {
  ticks$: Signal<Tick[]>;
}

const MAX_TICK_COUNT = 10;

export const axisTicks$ = ({
  range$,
  currentDisplayUnit$,
  measureTextSize$,
  lengthInPx$,
}: AxisTicksProps): AxisTicks => {
  const ticks$ = derived(($) =>
    linearTicks(
      $(range$),
      $(lengthInPx$),
      $(measureTextSize$) ?? ((s) => s.length * 10), // FIXME find a better solution
      $(currentDisplayUnit$),
    ),
  );

  return { ticks$ };
};

function linearTicks(
  range: Range,
  axisSize: number | undefined,
  textSize: (x: string) => number,
  displayUnit: DisplayUnit,
): Tick[] {
  if (axisSize === undefined) return [];
  if (isDateRange(range)) return dateTicks(range, axisSize, textSize);
  return quantityTicks(range, axisSize, textSize, displayUnit);
}

function quantityTicks(
  range: QuantityRange | NumericRange,
  axisSize: number,
  textSize: (x: string) => number,
  displayUnit: DisplayUnit,
): Tick[] {
  const numRange = toNumericRange(range, displayUnit);
  const numTicks = getNumericTicks(numRange, axisSize, textSize);

  return numTicks.map<Tick>(({ position, label }) => ({
    text: label,
    unit: displayUnit,
    position,
  }));
}

const niceMultiples = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100];

// TODO refactor
function dateTicks(
  range: DateRange,
  axisSize: number,
  textSize: (x: string) => number,
): Tick[] {
  const position = (
    val: dayjs.Dayjs, // FIXME replace with AxisValue
  ) =>
    1 - (range.to.unix() - val.unix()) / (range.to.unix() - range.from.unix());
  const unit = getRangeSpan(range);

  const tickFromVal = (val: dayjs.Dayjs): Tick => ({
    text: formatInEra(val, unit),
    position: position(val),
    subtext: formattedInLargerEra(val, unit),
    unit: NumericDateFormat.EpochSeconds, // FIXME is this what we want?
  });

  const firstTickVal = range.from.startOf(unit).add(1, unit);
  let result: Tick[] = [];
  for (const multiple of niceMultiples) {
    const rangeLength = range.to.startOf(unit).diff(firstTickVal, unit, true);
    const tickNum = rangeLength / multiple;

    if (tickNum > MAX_TICK_COUNT) continue;
    result = Array.from({ length: tickNum + 1 }, (_, index) =>
      tickFromVal(firstTickVal.add(index * multiple, unit)),
    );

    const longestLabel = result.reduce((prev, curr) => {
      const longestCurrLabel = Math.max(
        textSize(curr.text),
        textSize(curr.subtext ?? ""),
      );
      if (prev < longestCurrLabel) prev = longestCurrLabel;
      return prev;
    }, 0);

    if (longestLabel * tickNum < axisSize) break;
  }

  let lastLargerUnit = result[0]?.subtext;
  if (lastLargerUnit !== undefined) {
    for (let i = 1; i < result.length; i++) {
      if (result[i].subtext === lastLargerUnit) result[i].subtext = undefined;
      else lastLargerUnit = result[i].subtext;
    }
  }

  return result;
}

function getNumericTicks(
  range: NumericRange,
  axisSize: number,
  textSize: (x: string) => number,
): { label: string; position: number }[] {
  if (range.to === range.from) return [];

  const oneOrderLess = Math.floor(Math.log10(range.to - range.from)) - 1;

  let ticks: { label: string; position: number }[] = [];

  const rangeWidth = range.to - range.from;

  for (const multiple of niceMultiples) {
    const ticksDist = Math.pow(10, oneOrderLess) * multiple;
    const tickNum = rangeWidth / ticksDist;
    if (tickNum > MAX_TICK_COUNT) continue;

    const firstTickValue = range.from - (range.from % ticksDist) + ticksDist;
    const tickValues = Array.from(
      { length: tickNum + 1 },
      (_, n) => firstTickValue + n * ticksDist,
    );
    const decimalPlaces = uniqueDecimals(tickValues);
    ticks = tickValues.map((val) => ({
      label: qndFormat(val, { decimalPlaces }),
      position: (val - range.from) / rangeWidth,
    }));
    const tickSize = ticks.reduce(
      (prev, curr) =>
        prev < textSize(curr.label) ? textSize(curr.label) : prev,
      0,
    ); // upper estimate
    if (axisSize > tickNum * tickSize) break;
  }
  ticks = ticks.filter((tick) => tick.position >= 0 && tick.position <= 1);
  if (ticks.length == 0)
    ticks = [
      {
        label: qndFormat((range.from + range.to) / 2),
        position: 0.5,
      },
    ];
  return ticks;
}
