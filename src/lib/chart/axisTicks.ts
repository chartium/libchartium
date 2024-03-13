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

export interface AxisTicksProps {
  range$: Signal<Range>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  textSize$: Signal<(text: string) => number>;
  lengthInPx$: Signal<number>;
}

export interface AxisTicks {
  ticks$: Signal<Tick[]>;
}

export const axisTicks$ = ({
  range$,
  currentDisplayUnit$,
  textSize$,
  lengthInPx$,
}: AxisTicksProps): AxisTicks => {
  const ticks$ = derived(($) =>
    linearTicks(
      $(range$),
      $(lengthInPx$),
      $(textSize$),
      $(currentDisplayUnit$),
    ),
  );

  return { ticks$ };
};

function linearTicks(
  range: Range,
  axisSize: number,
  textMeasuringFunction: (x: string) => number,
  displayUnit: DisplayUnit,
): Tick[] {
  if (isDateRange(range)) {
    return dateTicks(range, axisSize, textMeasuringFunction);
  } else {
    return quantityTicks(range, axisSize, textMeasuringFunction, displayUnit);
  }
}

function quantityTicks(
  range: QuantityRange | NumericRange,
  axisSize: number,
  textMeasuringFunction: (x: string) => number,
  displayUnit: DisplayUnit,
): Tick[] {
  const numRange = toNumericRange(range, displayUnit);

  const numTicks = getNumericTicks({
    range: numRange,
    tickMeasuringFunction: textMeasuringFunction,
    axisSize,
    maxTickNum: 10,
  });

  const result: Tick[] = numTicks.map((tick) => ({
    value: tick.label,
    unit: displayUnit,
    position: tick.position,
  }));
  return result;
}

function dateTicks(
  range: DateRange,
  axisSize: number,
  textMeasuringFunction: (x: string) => number,
  maxTickNum: number = 10,
): Tick[] {
  const rangeUnits = getRangeSpan(range);
  const iLoveDayjsISwear = rangeUnits === "days" ? "date" : rangeUnits;
  const tickMeasuringFunction = (x: string) => {
    const templateDayjs = range.from.startOf(rangeUnits);
    const asDayjs = templateDayjs.set(iLoveDayjsISwear, parseFloat(x));
    const inEra = formatInEra(asDayjs, rangeUnits);
    const inBiggerEra = getLargerEra(asDayjs, rangeUnits) ?? "";
    return Math.max(
      textMeasuringFunction(inEra),
      textMeasuringFunction(inBiggerEra),
    );
  };

  const from = getFloatDayjsValue(range.from, rangeUnits);
  const to = from + range.to.diff(range.from, rangeUnits, true);
  const result = getNumericTicks({
    range: {
      from,
      to,
    },
    maxTickNum,
    tickMeasuringFunction,
    axisSize,
  })
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

function getNumericTicks({
  range,
  axisSize,
  tickMeasuringFunction: textMeasuringFunction,
  maxTickNum,
}: {
  range: NumericRange;
  axisSize: number;
  tickMeasuringFunction: (x: string) => number;
  maxTickNum: number;
}): { label: string; position: number }[] {
  if (range.to === range.from) return [];

  const oneOrderLess = Math.floor(Math.log10(range.to - range.from)) - 1;
  const niceMultiples = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100];

  let ticks: { label: string; position: number }[] = [];

  const rangeWidth = range.to - range.from;

  for (const multiple of niceMultiples) {
    const ticksDist = Math.pow(10, oneOrderLess) * multiple;
    const tickNum = rangeWidth / ticksDist;
    if (tickNum > maxTickNum) continue;

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
    const tickSize = textMeasuringFunction(ticks.at(-1)?.label ?? ""); // upper estimate
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
