import {
  Quantity,
  Unit,
  isQuantity,
  isUnit,
  type ChartValue,
  type DataUnit,
  type NumericRange,
  type ChartRange,
} from "../types.js";
import { isDayjs, type Dayjs } from "../utils/dayjs.js";
import {
  NumericDateRepresentation,
  isNumericDateRepresentation,
} from "../utils/numericDateRepresentation.js";
import { assertAllUnitsCompatible } from "./assert.js";

export const unitOf = (v: number | Dayjs | Quantity): DataUnit =>
  isQuantity(v)
    ? v.unit
    : isDayjs(v)
      ? NumericDateRepresentation.EpochMilliseconds()
      : undefined;

// TODO also add shift factor
export function unitConversionFactor(
  currentUnit: DataUnit,
  targetUnit: DataUnit,
) {
  assertAllUnitsCompatible([currentUnit, targetUnit]);
  if (currentUnit === undefined) {
    if (targetUnit === undefined) return 1;
    if (!isUnit(targetUnit)) throw TypeError();
    currentUnit = targetUnit.unitSystem.parseUnit("1");
  }
  if (isUnit(currentUnit)) {
    if (targetUnit === undefined)
      targetUnit = currentUnit.unitSystem.parseUnit("1");
    if (!isUnit(targetUnit)) throw TypeError();
    return currentUnit.conversionFactorTo(targetUnit);
  }
  if (!isNumericDateRepresentation(targetUnit)) throw TypeError();

  const currMs = currentUnit.duration.toMilliseconds(currentUnit.relativeTo);
  const targetMs = targetUnit.duration.toMilliseconds(targetUnit.relativeTo);

  return targetMs / currMs;
}

/** Transforms quantity to just numeric part in selected units. */
export function toNumeric(x: ChartValue, unit: DataUnit): number {
  if (typeof x === "number") return x;

  if (unit instanceof NumericDateRepresentation) {
    if (isDayjs(x)) return unit.valueFrom(x);

    throw new TypeError(
      "Attempting to convert an unsupported value from a date to a number.",
    );
  }

  if (unit) {
    if (isQuantity(x)) return x.inUnits(unit).value;

    throw new TypeError(
      "Attempting to convert an unsupported value from a quantity to a number.",
    );
  }

  if (isQuantity(x) && x.isUnitless)
    return x.value * x.unit.multiplyValueByFactor(1);

  throw new TypeError(
    "Attempting to convert a non-primitive to a number without specifying a unit.",
  );
}

/** Transforms range to numeric range in selected units. */
export function toNumericRange(
  range: ChartRange,
  unit: DataUnit,
): NumericRange {
  return {
    from: toNumeric(range.from, unit),
    to: toNumeric(range.to, unit),
  };
}

/**
 * Returns quantity if units are defined, otherwise returns number.
 * If input is quantity, will convert units.
 */
export function toChartValue(x: number, unit: DataUnit): ChartValue {
  if (unit instanceof NumericDateRepresentation) return unit.convertToDayjs(x);
  if (typeof x === "number" && unit) return new Quantity(x, unit);
  return x;
}

/** Returns range in units if defined, otherwise returns numeric range */
export function toChartRange(
  range: NumericRange,
  units?: Unit | NumericDateRepresentation,
): ChartRange {
  return {
    from: toChartValue(range.from, units),
    to: toChartValue(range.to, units),
  } as ChartRange;
}
