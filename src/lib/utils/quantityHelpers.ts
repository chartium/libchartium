import { NumericDateRepresentation } from "./numericDateRepresentation.js";
import {
  Quantity,
  type NumericRange,
  type Unit,
  type Range,
  type ChartValue,
  isQuantity,
  isUnit,
} from "../types.js";
import { SI } from "unitlib/systems";
import { isDayjs, type Dayjs, dayjs } from "./dayjs.js";

/** Transforms quantity to just numeric part in selected units. */
export function toNumeric(
  x: Quantity | number | Dayjs,
  unit: Unit | NumericDateRepresentation | undefined,
): number {
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
  range: Range,
  unit: Unit | NumericDateRepresentation | undefined,
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
export function toQuantOrDay(
  x: number,
  units?: Unit | NumericDateRepresentation,
  dataUnits?: Unit,
): Quantity | Dayjs | number {
  if (units instanceof NumericDateRepresentation)
    return units.convertToDayjs(x);
  if (typeof x === "number" && units) {
    const q = new Quantity(x, units);
    if (dataUnits) return q.inUnits(dataUnits);
    return q;
  }
  return x;
}

/** Returns range in units if defined, otherwise returns numeric range */
export function toRange(
  range: NumericRange,
  units?: Unit | NumericDateRepresentation,
): Range {
  return {
    from: toQuantOrDay(range.from, units),
    to: toQuantOrDay(range.to, units),
  } as Range;
}

const milliseconds = SI.parseUnit("ms");

export function eq(
  a: number | Quantity | Dayjs | Unit | undefined,
  b: number | Quantity | Dayjs | Unit | undefined,
): boolean {
  if (typeof a === "number" || a === undefined) return a === b;
  if (isQuantity(a) && isQuantity(b)) return a.isEqual(b);
  if (isUnit(a) && isUnit(b)) return a.isEqual(b);
  if (isDayjs(a) && isDayjs(b)) return +a === +b;
  return false;
}

export function add(
  a: number | Quantity | Dayjs,
  b: number | Quantity | Dayjs,
) {
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

export function subtract(
  a: number | Quantity | Dayjs,
  b: number | Quantity | Dayjs,
) {
  if (typeof b === "number") return add(a, -b);
  if (isQuantity(b)) return add(a, b.negative());
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
export function qdnMin(x: number, y: number): number;
export function qdnMin(x: Quantity, y: Quantity): Quantity;
export function qdnMin(x: Dayjs, y: Dayjs): Dayjs;
export function qdnMin(x: ChartValue, y: ChartValue): ChartValue {
  if (typeof x === "number" && typeof y === "number") {
    return Math.min(x, y);
  } else if (isQuantity(x) && isQuantity(y)) {
    return x.lessThan(y) ? x : y;
  } else {
    return (x as Dayjs).isBefore(y as Dayjs) ? x : y;
  }
}

/** Returns the larger of the two inputs */
export function qdnMax(x: number, y: number): number;
export function qdnMax(x: Quantity, y: Quantity): Quantity;
export function qdnMax(x: Dayjs, y: Dayjs): Dayjs;
export function qdnMax(x: ChartValue, y: ChartValue): ChartValue {
  if (typeof x === "number" && typeof y === "number") {
    return Math.max(x, y);
  } else if (isQuantity(x) && isQuantity(y)) {
    return x.greaterThan(y) ? x : y;
  } else {
    return (x as Dayjs).isAfter(y as Dayjs) ? x : y;
  }
}

export function unitEqual(
  a: Unit | NumericDateRepresentation | undefined,
  b: Unit | NumericDateRepresentation | undefined,
): boolean {
  if (a === undefined) return b === undefined;
  if (
    a instanceof NumericDateRepresentation !==
    b instanceof NumericDateRepresentation
  )
    return false;
  return a.isEqual(b as any);
}
