import {
  NumericDateRepresentation,
  isNumericDateRepresentation,
} from "./numericDateRepresentation.js";
import {
  Quantity,
  type NumericRange,
  type Unit,
  type Range,
  type ChartValue,
  isQuantity,
  isUnit,
  type DataUnit,
  type DisplayUnit,
  isRange,
} from "../types.js";
import { SI } from "unitlib/systems";
import { isDayjs, type Dayjs, dayjs } from "./dayjs.js";
import { isDateFormat } from "./dateFormat.js";
import { isDuration, Duration } from "./duration.js";

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
export function toNumericRange(range: Range, unit: DataUnit): NumericRange {
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
export function toRange(
  range: NumericRange,
  units?: Unit | NumericDateRepresentation,
): Range {
  return {
    from: toChartValue(range.from, units),
    to: toChartValue(range.to, units),
  } as Range;
}

export function areUnitsCompatible(
  a: DataUnit | DisplayUnit,
  b: DataUnit | DisplayUnit,
): boolean {
  if (a === undefined) {
    if (b === undefined) return true;
    if (isUnit(b)) return b.isUnitless;
    return false;
  }
  if (b === undefined) return isUnit(a) && a.isUnitless;
  if (isNumericDateRepresentation(a) || isDateFormat(a)) {
    return isNumericDateRepresentation(b) || isDateFormat(b);
  }
  if (isNumericDateRepresentation(b) || isDateFormat(b)) return false;
  return a.isCompatible(b);
}
export function assertAllUnitsCompatible(
  units: Iterable<DataUnit | DisplayUnit>,
) {
  const arr = [...units];
  const first = arr.pop();
  for (const next of arr) {
    if (!areUnitsCompatible(first, next)) {
      throw new TypeError(
        `Incompatible units: "${first}" is not compatible with "${next}"`,
      );
    }
  }
}

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

export function eq(
  a: ChartValue | DataUnit | DisplayUnit | Duration | Range | undefined,
  b: ChartValue | DataUnit | DisplayUnit | Duration | Range | undefined,
): boolean {
  if (typeof a === "number" || a === undefined) return a === b;
  if (isQuantity(a) && isQuantity(b)) return a.isEqual(b);
  if (isUnit(a) && isUnit(b)) return a.isEqual(b);
  if (isDayjs(a) && isDayjs(b)) return +a === +b;
  if (isRange(a) && isRange(b)) return eq(a.from, b.from) && eq(a.to, b.to);
  if (isDuration(a) && isDuration(b)) return a.isEqual(b);
  if (isDateFormat(a) && isDateFormat(b)) return a.isEqual(b);
  if (isNumericDateRepresentation(a) && isNumericDateRepresentation(b)) {
    return a.isEqual(b);
  }
  return false;
}

const milliseconds = SI.parseUnit("ms");

export function add(a: ChartValue | Duration, b: ChartValue | Duration) {
  if (a === 0 || (isQuantity(a) && a.value === 0)) return b;
  if (b === 0 || (isQuantity(b) && b.value === 0)) return a;
  if (typeof a === "number") {
    if (typeof b === "number") return a + b;
    if (isQuantity(b) && b.isUnitless) return a + b.value;
    if (isQuantity(b))
      throw TypeError(`Attempting to add a unitless number to ${b.unit}.`);
    throw TypeError("Attempting to add a unitless number to a date.");
  }
  if (typeof b === "number") {
    if (typeof a === "number") return a + b;
    if (isQuantity(a) && a.isUnitless) return a.value + b;
    if (isQuantity(a))
      throw TypeError(`Attempting to add a unitless number to ${a.unit}.`);
    throw TypeError("Attempting to add a unitless number to a date.");
  }
  if (isDuration(a)) {
    if (isQuantity(b))
      return a.add({ milliseconds: b.inUnits(milliseconds).value });
    if (isDayjs(b)) return a.add(b);
    return a.add(b);
  }
  if (isDuration(b)) {
    if (isQuantity(a))
      return b.add({ milliseconds: a.inUnits(milliseconds).value });
    return b.add(a);
  }
  if (isQuantity(a)) {
    if (isQuantity(b)) return a.add(b);
    return dayjs(new Date(+b + a.inUnits(milliseconds).value));
  }
  if (isQuantity(b)) {
    if (isQuantity(a)) return a.add(b);
    return dayjs(new Date(+a + b.inUnits(milliseconds).value));
  }
  throw TypeError("Cannot add two dates.");
}

export function subtract(a: ChartValue | Duration, b: ChartValue | Duration) {
  if (typeof b === "number") return add(a, -b);
  if (isQuantity(b)) return add(a, b.negative());
  if (isDuration(b)) return add(a, b.multiply(-1));
  if (dayjs.isDayjs(a)) return new Quantity(+a - +b, milliseconds);
  throw TypeError("Attempting to subtract a date from an incompatible type.");
}

export function multiply(a: number | Quantity, b: number | Quantity) {
  if (isQuantity(a)) return a.multiply(b);
  if (isQuantity(b)) return b.multiply(a);
  return a * b;
}

export function divide(a: number | Quantity, b: number | Quantity) {
  if (isQuantity(b)) return multiply(a, b.inverse());
  return multiply(a, 1 / b);
}

/** Returns the smaller of the two inputs */
export function minValue(x: number, y: number): number;
export function minValue(x: Quantity, y: Quantity): Quantity;
export function minValue(x: Dayjs, y: Dayjs): Dayjs;
export function minValue(x: ChartValue, y: ChartValue): ChartValue;
export function minValue(x: ChartValue, y: ChartValue): ChartValue {
  if (typeof x === "number" && typeof y === "number") {
    return Math.min(x, y);
  } else if (isQuantity(x) && isQuantity(y)) {
    return x.lessThan(y) ? x : y;
  } else {
    return (x as Dayjs).isBefore(y as Dayjs) ? x : y;
  }
}

/** Returns the larger of the two inputs */
export function maxValue(x: number, y: number): number;
export function maxValue(x: Quantity, y: Quantity): Quantity;
export function maxValue(x: Dayjs, y: Dayjs): Dayjs;
export function maxValue(x: ChartValue, y: ChartValue): ChartValue;
export function maxValue(x: ChartValue, y: ChartValue): ChartValue {
  if (typeof x === "number" && typeof y === "number") {
    return Math.max(x, y);
  } else if (isQuantity(x) && isQuantity(y)) {
    return x.greaterThan(y) ? x : y;
  } else {
    return (x as Dayjs).isAfter(y as Dayjs) ? x : y;
  }
}