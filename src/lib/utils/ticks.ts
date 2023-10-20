import dayjs from "dayjs";
import type {
  DateRange,
  NumericRange,
  QuantityRange,
  Range,
  Tick,
  Unit,
} from "../types.js";
import { formatInEra, getLargerEra, getRangeSpan } from "./dateFormatter.js";
import { toNumericRange } from "./quantityHelpers.js";

const boxes: number[] = [1, 2, 5, 10];

/** Returs position of the first tick and distance inbetween ticks for linear tick generation */
function getTickPlaceAndDist(range: NumericRange): {
  firstTick: number;
  ticksDist: number;
} {
  const { from, to } = toNumericRange(range);
  const width = to - from;

  let firstTick: number = 0.0;
  let ticksDist: number = 1.0;

  let order = Math.floor(Math.log10(width)) - 1;

  for (const size of boxes) {
    ticksDist = Math.pow(10, order) * size;
    firstTick = Math.floor(from / ticksDist) * ticksDist;

    if ((to - firstTick) / ticksDist < 10) {
      break;
    }
  }

  return { firstTick, ticksDist };
}

export const linearQuantityTicks = (
  // TODO make a function that does both quantity and date
  range: NumericRange | QuantityRange,
  dataUnit?: Unit,
  displayUnit?: Unit
): Tick[] => {
  const { from, to } = toNumericRange(range);
  const width = to - from;
  const { firstTick, ticksDist } = getTickPlaceAndDist(toNumericRange(range));

  const result: Tick[] = [];

  const factor = displayUnit ? dataUnit?.divide(displayUnit) : undefined;

  for (let i = 1; i <= Math.floor((to - firstTick) / ticksDist); ++i) {
    const value = firstTick + ticksDist * i;
    result.push({
      value: factor ? factor.multiplyValueByFactor(value) : value,
      position: (firstTick + ticksDist * i - from) / width,
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

  const { firstTick, ticksDist } = getTickPlaceAndDist({
    from: 0,
    to: rangeWidth,
  });

  let currentTick = dRange.from.add(firstTick, rangeUnits);
  const toReturn: Tick[] = [];

  while (currentTick.isBefore(dRange.to)) {
    const position =
      currentTick.diff(dRange.from, rangeUnits, true) / rangeWidth;
    const largerEra = getLargerEra(currentTick, rangeUnits);

    const thisTick = {
      position,
      value: formatInEra(currentTick, rangeUnits),
      unit: undefined,
      subvalue: toReturn.some((tick) => tick.subvalue !== largerEra)
        ? largerEra
        : undefined,
    };

    toReturn.push(thisTick);
    currentTick = currentTick.add(ticksDist, rangeUnits);
  }

  return toReturn;
}
