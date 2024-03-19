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
  getLargerEra,
  getRangeSpan,
} from "../utils/dateFormatter.js";

export type TextMeasuringFunction = (text: string) => number;

export interface AxisTicksProps {
  range$: Signal<Range>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  measureTextSize$: Signal<TextMeasuringFunction | undefined>;
  lengthInPx$: Signal<number>;
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
  axisSize: number,
  textSize: (x: string) => number,
  displayUnit: DisplayUnit,
): Tick[] {
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
    value: label,
    unit: displayUnit,
    position,
  }));
}

// TODO refactor
function dateTicks(
  range: DateRange,
  axisSize: number,
  textSize: (x: string) => number,
): Tick[] {
  const rangeUnits = getRangeSpan(range);
  const iLoveDayjsISwear = rangeUnits === "days" ? "date" : rangeUnits;
  const tickMeasuringFunction = (x: string) => {
    const templateDayjs = range.from.startOf(rangeUnits);
    const asDayjs = templateDayjs.set(iLoveDayjsISwear, parseFloat(x));
    const inEra = formatInEra(asDayjs, rangeUnits);
    const inBiggerEra = getLargerEra(asDayjs, rangeUnits) ?? "";
    return Math.max(textSize(inEra), textSize(inBiggerEra));
  };

  const from = getFloatDayjsValue(range.from, rangeUnits);
  const to = from + range.to.diff(range.from, rangeUnits, true);
  const result = getNumericTicks({ from, to }, axisSize, tickMeasuringFunction)
    .map((numTick) => ({
      value: range.from.set(iLoveDayjsISwear, parseFloat(numTick.label)),
      position: numTick.position,
    }))
    .reduce((acc: Tick[], tick) => {
      const largerEra = getLargerEra(tick.value, rangeUnits);
      const thisTick = {
        position: tick.position,
        value: formatInEra(tick.value, rangeUnits),
        subvalue: acc.some((tick) => tick.subvalue === largerEra)
          ? undefined
          : largerEra,
        unit: undefined,
      };
      acc.push(thisTick);
      return acc;
    }, [] as Tick[]);

  return result;
}

function getNumericTicks(
  range: NumericRange,
  axisSize: number,
  textSize: (x: string) => number,
): { label: string; position: number }[] {
  if (range.to === range.from) return [];

  const oneOrderLess = Math.floor(Math.log10(range.to - range.from)) - 1;
  const niceMultiples = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100];

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
    const tickSize = textSize(ticks.at(-1)?.label ?? ""); // upper estimate
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
