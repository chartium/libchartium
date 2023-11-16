import dayjs from "dayjs";
import {
  Quantity,
  type DateRange,
  type NumericRange,
  type QuantityRange,
  type Range,
  type Tick,
  type Unit,
  isDateRange,
  isNumericRange,
} from "../types.js";
import {
  formatInEra,
  getFloatDayjsValue,
  getLargerEra,
  getRangeSpan,
} from "./dateFormatter.js";
import { toRange, toNumericRange } from "./quantityHelpers.js";
import { fitsIntoDecimals, prettyExp, uniqueDecimals } from "./format.js";
import { NumericDateFormat } from "./numericDateFormat.js";

const boxes: number[] = [1, 2, 5, 10];

/** Returs position of the first tick and distance inbetween ticks for linear tick generation */
function getTickPlaceAndDist(range: NumericRange): {
  firstTickValue: number;
  ticksDist: number;
} {
  const { from, to } = range;
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

export function linearTicks({
  range,
  dataUnit,
  displayUnit,
}: {
  range: Range;
  dataUnit: Unit | NumericDateFormat | undefined;
  displayUnit: Unit | undefined;
}): Tick[] {
  if (isDateRange(range)) {
    if (!(dataUnit instanceof NumericDateFormat)) {
      throw TypeError(
        "The data unit for a DateRange must be a NumericDataFormat"
      );
    }
    if (displayUnit !== undefined) {
      throw TypeError("Invalid display unit for a DateRange");
    }

    return linearDateTicks({ range, displayUnit, dataUnit });
  } else {
    if (dataUnit instanceof NumericDateFormat) {
      throw TypeError(
        "NumericDateFormat is not a valid data unit for NumericRange and QuantityRange"
      );
    }

    if (isNumericRange(range)) {
      if (!(dataUnit?.isUnitless ?? true)) {
        throw TypeError(
          "Only unitless data units are supported for NumericRange"
        );
      }
      if (!(displayUnit?.isUnitless ?? true)) {
        throw TypeError(
          "Only unitless display units are supported for NumericRange"
        );
      }
    }
    return linearQuantityTicks({ range, displayUnit, dataUnit });
  }
}

const linearQuantityTicks = ({
  range,
  dataUnit,
  displayUnit,
}: {
  range: QuantityRange | NumericRange;
  dataUnit: Unit | undefined;
  displayUnit: Unit | undefined;
}): Tick[] => {
  const { from, to } = toNumericRange(range, dataUnit);
  const width = to - from;
  const { firstTickValue, ticksDist } = getTickPlaceAndDist(
    toNumericRange(range, dataUnit)
  );

  let result: { value: number; position: number; unit: Unit | undefined }[] =
    [];

  const factor = displayUnit ? dataUnit?.divide(displayUnit) : undefined;

  for (let i = 1; i <= Math.floor((to - firstTickValue) / ticksDist); ++i) {
    const value = firstTickValue + ticksDist * i;
    result.push({
      value: factor ? factor.multiplyValueByFactor(value) : value,
      position: (firstTickValue + ticksDist * i - from) / width,
      unit: factor ? displayUnit : undefined,
    });
  }

  if (result.every((tick) => typeof tick.value === "number")) {
    const decimals = Math.max(
      2,
      uniqueDecimals(result.map((tick) => tick.value))
    );
    return result.map((tick) => ({
      ...tick,
      value: tick.value.toFixed(decimals),
    }));
  } else {
    return result.map((tick) => ({
      ...tick,
      value: tick.value.toString(),
    }));
  }
};

function linearDateTicks({
  range,
}: {
  range: DateRange;
  dataUnit: NumericDateFormat;
  displayUnit: undefined;
}): Tick[] {
  const rangeUnits = getRangeSpan(range);

  const rangeWidth = range.to.diff(range.from, rangeUnits, true);

  const from = getFloatDayjsValue(range.from, rangeUnits);
  const to = from + range.to.diff(range.from, rangeUnits, true);
  const { firstTickValue, ticksDist } = getTickPlaceAndDist({
    from,
    to,
  });

  let currentTick = range.from
    .startOf(rangeUnits)
    .add(firstTickValue % 1, rangeUnits);
  const result: Tick[] = [];

  while (currentTick.isBefore(range.to)) {
    const position =
      currentTick.diff(range.from, rangeUnits, true) / rangeWidth;
    const largerEra = getLargerEra(currentTick, rangeUnits);

    const thisTick = {
      position,
      value: formatInEra(currentTick, rangeUnits),
      unit: undefined,
      subvalue: result.some((tick) => tick.subvalue === largerEra)
        ? undefined
        : largerEra,
    };

    if (position >= 0 && position <= 1) {
      result.push(thisTick);
    }
    currentTick = currentTick.add(ticksDist, rangeUnits);
  }

  return result;
}
