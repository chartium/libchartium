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
  type DateRangeSpan,
} from "./dateFormatter.js";
import { toRange, toNumericRange } from "./quantityHelpers.js";
import { fitsIntoDecimals, prettyExp, uniqueDecimals } from "./format.js";
import { NumericDateFormat } from "./numericDateFormat.js";

const boxes: number[] = [1, 2, 5, 10, 15, 20, 25];

/** Returs position of the first tick and distance inbetween ticks for linear tick generation */
function getTickPlaceAndDist(
  range: NumericRange,
  maxTickNum: number
): {
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
    if ((to - firstTickValue) / ticksDist < maxTickNum) {
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
    toNumericRange(range, dataUnit),
    10
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
  const { firstTickValue, ticksDist } = getTickPlaceAndDist(
    {
      from,
      to,
    },
    10
  );

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
  const oneOrderLess = Math.floor(Math.log10(range.to - range.from)) - 1;
  const niceMultiples = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100];

  let ticks: { label: string; position: number }[] = [];

  const rangeWidth = range.to - range.from;

  for (const multiple of niceMultiples) {
    const ticksDist = Math.pow(10, oneOrderLess) * multiple;
    const tickNum = rangeWidth / ticksDist;
    if (tickNum > maxTickNum) continue;
    const firstTickValue = range.from - (range.from % ticksDist) + ticksDist;
    const tickVals = Array.from(
      { length: tickNum + 1 },
      (_, n) => firstTickValue + n * ticksDist
    );
    const decimals = uniqueDecimals(tickVals);
    ticks = tickVals.map((val) => ({
      label: val.toFixed(decimals),
      position: (val - range.from) / rangeWidth,
    }));
    const tickSize = textMeasuringFunction(ticks.at(-1)!.label); // upper estimate
    if (axisSize > tickNum * tickSize) break;
  }
  ticks = ticks.filter((tick) => tick.position >= 0 && tick.position <= 1);
  if (ticks.length == 0)
    ticks = [
      {
        label: ((range.from + range.to) / 2).toString(),
        position: 0.5,
      },
    ];
  return ticks;
}

function quantityLinearTicksFR({
  range,
  axisSize,
  textMeasuringFunction,
  displayUnit,
  maxTickNum = 10,
}: {
  range: QuantityRange | NumericRange;
  axisSize: number;
  textMeasuringFunction: (x: string) => number;
  displayUnit: Unit | undefined;
  maxTickNum?: number;
}): Tick[] {
  const numRange = toNumericRange(range, displayUnit);

  const numTicks = getNumericTicks({
    range: numRange,
    tickMeasuringFunction: textMeasuringFunction,
    axisSize,
    maxTickNum,
  });

  const result: Tick[] = numTicks.map((tick) => ({
    value: tick.label,
    unit: displayUnit,
    position: tick.position,
  }));
  return result;
}

function linearDateTicksFR(
  range: DateRange,
  axisSize: number,
  textMeasuringFunction: (x: string) => number,
  maxTickNum: number = 10
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
      textMeasuringFunction(inBiggerEra)
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

export function linearTicksFR({
  range,
  axisSize,
  textMeasuringFunction,
  displayUnit,
}: {
  range: Range;
  axisSize: number;
  textMeasuringFunction: (x: string) => number;
  displayUnit: Unit | undefined | NumericDateFormat;
}): Tick[] {
  const unit =
    displayUnit instanceof NumericDateFormat ? undefined : displayUnit;
  if (isDateRange(range)) {
    return linearDateTicksFR(range, axisSize, textMeasuringFunction);
  } else {
    return quantityLinearTicksFR({
      range,
      axisSize,
      textMeasuringFunction,
      displayUnit: unit,
    });
  }
}
