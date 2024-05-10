import { derived, type Signal } from "@mod.js/signals";
import {
  isDateRange,
  type NumericRange,
  type QuantityRange,
  type Range,
  type Tick,
  type DateRange,
  type DisplayUnit,
  Unit,
} from "../../types.js";
import type { Dayjs } from "../../utils/dayjs.js";
import { toNumericRange } from "../../utils/unit.js";
import { qndFormat, uniqueDecimals } from "../../utils/format.js";
import { isDateFormat, type DateFormat } from "../../utils/dateFormat.js";
// import {
//   formatInEra,
//   formattedInLargerEra,
//   getRangeSpan,
// } from "../utils/dateFormat.js";

export type TextMeasuringFunction = (text: string) => number;

export interface AxisTicksProps {
  range$: Signal<Range>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  measureTextSize$: Signal<TextMeasuringFunction>;
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
      $(measureTextSize$),
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
  if (isDateRange(range)) {
    if (!isDateFormat(displayUnit))
      throw TypeError(
        "Trying to format a date with incorrect display unit: " + displayUnit,
      );
    return dateTicks(range, displayUnit, axisSize, textSize);
  }

  if (isDateFormat(displayUnit)) {
    throw TypeError("Trying to format a quantity with a date format");
  }

  return quantityTicks(range, axisSize, textSize, displayUnit);
}

function quantityTicks(
  range: QuantityRange | NumericRange,
  axisSize: number,
  textSize: (x: string) => number,
  displayUnit: Unit | undefined,
): Tick[] {
  const numRange = toNumericRange(range, displayUnit);
  if (numRange.to === numRange.from) return [];

  let ticks: { label: string; position: number }[] = [];

  const rangeWidth = numRange.to - numRange.from;

  for (const multiple of niceMultiples) {
    const oneOrderLess =
      Math.floor(Math.log10(numRange.to - numRange.from)) - 1;
    const distance = Math.pow(10, oneOrderLess) * multiple;
    const maxTickNum = rangeWidth / distance;

    const firstTickValue = numRange.from - (numRange.from % distance);
    const tickValues = Array.from(
      { length: maxTickNum + 2 },
      (_, n) => firstTickValue + n * distance,
    ).filter((tickVal) => tickVal >= numRange.from && tickVal <= numRange.to);
    if (tickValues.length > MAX_TICK_COUNT) continue;

    const decimalPlaces = uniqueDecimals(tickValues);
    ticks = tickValues.map((val) => ({
      label: qndFormat(val, { decimalPlaces }),
      position: (val - numRange.from) / rangeWidth,
    }));
    const tickSize = ticks.reduce(
      (prev, curr) =>
        prev < textSize(curr.label) ? textSize(curr.label) : prev,
      0,
    ); // upper estimate
    if (axisSize > maxTickNum * tickSize) break;
  }
  if (ticks.length == 0)
    ticks = [
      {
        label: qndFormat((numRange.from + numRange.to) / 3),
        position: 0.33,
      },
      {
        label: qndFormat(((numRange.from + numRange.to) * 2) / 3),
        position: 0.67,
      },
    ];

  return ticks.map<Tick>(({ position, label }) => ({
    text: label,
    unit: displayUnit,
    position,
  }));
}

const niceMultiples = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100];

// TODO refactor
function dateTicks(
  range: DateRange,
  displayUnit: DateFormat,
  axisSize: number,
  textSize: (x: string) => number,
): Tick[] {
  const position = (
    val: Dayjs, // FIXME replace with AxisValue
  ) =>
    1 - (range.to.unix() - val.unix()) / (range.to.unix() - range.from.unix());
  const period = displayUnit.getPeriodOfRange(range);

  const tickFromVal = (val: Dayjs): Tick => ({
    text: displayUnit.formatInPeriod(val, period),
    position: position(val),
    subtext: displayUnit.formatInLargerPeriod(val, period),
  });

  const firstTickVal = range.from.startOf(period).isSame(range.from)
    ? range.from
    : range.from.startOf(period).add(1, period);
  let result: Tick[] = [];
  for (const multiple of niceMultiples) {
    const rangeLength = range.to
      .startOf(period)
      .diff(firstTickVal, period, true);
    const tickNum = rangeLength / multiple + 1;

    if (tickNum > MAX_TICK_COUNT) continue;
    result = Array.from({ length: tickNum }, (_, index) =>
      tickFromVal(firstTickVal.add(index * multiple, period)),
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
