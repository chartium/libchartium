import dayjs from "dayjs";
import {
  Quantity,
  type DateRange,
  type NumericRange,
  type QuantityRange,
  type Range,
  type Tick,
  type Unit,
} from "../types.js";
import {
  formatInEra,
  getFloatDayjsValue,
  getLargerEra,
  getRangeSpan,
} from "./dateFormatter.js";
import { toDateRange, toNumericRange } from "./quantityHelpers.js";

const boxes: number[] = [1, 2, 5, 10];

/** Returs position of the first tick and distance inbetween ticks for linear tick generation */
function getTickPlaceAndDist(range: NumericRange): {
  firstTickValue: number;
  ticksDist: number;
} {
  const { from, to } = toNumericRange(range);
  const width = to - from;

  let firstTickValue: number = 0.0;
  let ticksDist: number = 1.0;

  let order = Math.floor(Math.log10(width)) - 1;

  for (const size of boxes) {
    ticksDist = Math.pow(10, order) * size;
    firstTickValue = Math.floor(from / ticksDist) * ticksDist;

    if ((to - firstTickValue) / ticksDist < 10) {
      break;
    }
  }

  return { firstTickValue, ticksDist };
}

export function linearTicks(
  range: Range,
  displayUnit?: Unit | "date",
  dataUnit?: Unit | "date"
): Tick[] {
  if (dataUnit === "date" || displayUnit === "date") {
    if (range.from instanceof Quantity || range.to instanceof Quantity) {
      throw new Error("Range contains quantities but you assume date");
    }
    return linearDateTicks(toDateRange(range as DateRange | NumericRange));
  } else
    return linearQuantityTicks(range as QuantityRange, displayUnit, dataUnit);
}

export const linearQuantityTicks = (
  range: NumericRange | QuantityRange,
  dataUnit?: Unit,
  displayUnit?: Unit
): Tick[] => {
  const { from, to } = toNumericRange(range);
  const width = to - from;
  const { firstTickValue, ticksDist } = getTickPlaceAndDist(
    toNumericRange(range)
  );

  const result: Tick[] = [];

  const factor = displayUnit ? dataUnit?.divide(displayUnit) : undefined;

  for (let i = 1; i <= Math.floor((to - firstTickValue) / ticksDist); ++i) {
    const value = firstTickValue + ticksDist * i;
    result.push({
      value: factor ? factor.multiplyValueByFactor(value) : value,
      position: (firstTickValue + ticksDist * i - from) / width,
      unit: factor ? displayUnit : undefined,
    });
  }

  return result;
};

export function linearDateTicks(range: DateRange): Tick[] {
  const rangeUnits = getRangeSpan(range);

  const dRange = {
    // hehe, dRange... Derrange
    from: dayjs(range.from),
    to: dayjs(range.to),
  };

  const rangeWidth = dRange.to.diff(dRange.from, rangeUnits, true);

  const from = getFloatDayjsValue(dRange.from, rangeUnits);
  const to = from + dRange.to.diff(dRange.from, rangeUnits, true);
  const { firstTickValue, ticksDist } = getTickPlaceAndDist({
    from,
    to,
  });

  let currentTick = dayjs(range.from)
    .startOf(rangeUnits)
    .add(firstTickValue % 1, rangeUnits);
  const toReturn: Tick[] = [];

  while (currentTick.isBefore(dRange.to)) {
    const position =
      currentTick.diff(dRange.from, rangeUnits, true) / rangeWidth;
    const largerEra = getLargerEra(currentTick, rangeUnits);

    const thisTick = {
      position,
      value: formatInEra(currentTick, rangeUnits),
      unit: undefined,
      subvalue: toReturn.some((tick) => tick.subvalue === largerEra)
        ? undefined
        : largerEra,
    };

    if (position >= 0 && position <= 1) {
      toReturn.push(thisTick);
    }
    currentTick = currentTick.add(ticksDist, rangeUnits);
  }

  return toReturn;
}
