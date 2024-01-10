/** THelper functions to make the code shorter */

import dayjs, { isDayjs, type Dayjs } from "dayjs";
import { NumericDateFormat } from "./numericDateFormat.js";
import {
  Quantity,
  type NumericRange,
  type Unit,
  type Range,
} from "../types.js";
import { SI } from "unitlib/systems";
import { Unit as UUnit } from "unitlib";

/** Transforms quantity to just numeric part in selected units. */
export function toNumeric(
  x: Quantity | number | Dayjs,
  unit: Unit | NumericDateFormat | undefined
): number {
  if (typeof x === "number") return x;

  if (unit instanceof NumericDateFormat) {
    if (dayjs.isDayjs(x)) return unit.valueFrom(x);

    throw new TypeError(
      "Attempting to convert an unsupported value from a date to a number."
    );
  }

  if (unit) {
    if (x instanceof Quantity) return x.inUnits(unit).value;

    throw new TypeError(
      "Attempting to convert an unsupported value from a quantity to a number."
    );
  }

  console.log(x, unit);
  throw new TypeError(
    "Attempting to convert a non-primitive to a number without specifying a unit."
  );
}

/** Transforms range to numeric range in selected units. */
export function toNumericRange(
  range: Range,
  unit: Unit | NumericDateFormat | undefined
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
  units?: Unit | NumericDateFormat
): Quantity | Dayjs | number {
  if (units instanceof NumericDateFormat) return units.parseToDayjs(x);
  if (typeof x === "number" && units) return new Quantity(x, units);
  else return x;
}

export function toQuantOrDayRange(
  r: NumericRange,
  units?: Unit | NumericDateFormat
): Range {
  return {
    from: toQuantOrDay(r.from, units),
    to: toQuantOrDay(r.to, units),
  } as Range;
}

/** Returns range in units if defined, otherwise returns numeric range */
export function toRange(
  range: NumericRange,
  units?: Unit | NumericDateFormat
): Range {
  return {
    from: toQuantOrDay(range.from, units),
    to: toQuantOrDay(range.to, units),
  } as Range;
}

const milliseconds = SI.parseUnit("ms");

export function eq(
  a: number | Quantity | Dayjs | Unit | undefined,
  b: number | Quantity | Dayjs | Unit | undefined
): boolean {
  if (typeof a === "number" || a === undefined) return a === b;
  if (a instanceof Quantity && b instanceof Quantity) return a.isEqual(b);
  if (a instanceof UUnit && b instanceof UUnit) return a.isEqual(b);
  if (isDayjs(a) && isDayjs(b)) return +a === +b;
  return false;
}

export function add(
  a: number | Quantity | Dayjs,
  b: number | Quantity | Dayjs
) {
  if (a === 0 || (a instanceof Quantity && a.value === 0)) return b;
  if (b === 0 || (b instanceof Quantity && b.value === 0)) return a;
  if (typeof a === "number") {
    if (typeof b === "number") return a + b;
    if (b instanceof Quantity && b.isUnitless) return a + b.value;
    if (b instanceof Quantity)
      throw TypeError(`Attempting to add a unitless number to ${b.unit}.`);
    throw TypeError("Attempting to add a unitless number to a date.");
  }
  if (typeof b === "number") {
    if (typeof a === "number") return a + b;
    if (a instanceof Quantity && a.isUnitless) return a.value + b;
    if (a instanceof Quantity)
      throw TypeError(`Attempting to add a unitless number to ${a.unit}.`);
    throw TypeError("Attempting to add a unitless number to a date.");
  }
  if (a instanceof Quantity) {
    if (b instanceof Quantity) return a.add(b);
    return dayjs(new Date(+b + a.inUnits(milliseconds).value));
  }
  if (b instanceof Quantity) {
    if (a instanceof Quantity) return a.add(b);
    return dayjs(new Date(+a + b.inUnits(milliseconds).value));
  }
  throw TypeError("Cannot add two dates.");
}

export function subtract(
  a: number | Quantity | Dayjs,
  b: number | Quantity | Dayjs
) {
  if (typeof b === "number") return add(a, -b);
  if (b instanceof Quantity) return add(a, b.negative());
  if (dayjs.isDayjs(a)) return new Quantity(+a - +b, milliseconds);
  throw TypeError("Attempting to subtract a date from an incompatible type.");
}

export function multiply(a: number | Quantity, b: number | Quantity) {
  if (a instanceof Quantity) return a.multiply(b);
  if (b instanceof Quantity) return b.multiply(a);
  return a * b;
}

export function divide(a: number | Quantity, b: number | Quantity) {
  if (b instanceof Quantity) return multiply(a, b.inverse());
  return multiply(a, 1 / b);
}

/** Returns the smaller of the two inputs */
export function qdnMin(x: number, y: number): number;
export function qdnMin(x: Quantity, y: Quantity): Quantity;
export function qdnMin(x: Dayjs, y: Dayjs): Dayjs;
export function qdnMin(
  x: number | Quantity | Dayjs,
  y: number | Quantity | Dayjs
): number | Quantity | Dayjs {
  if (typeof x === "number" && typeof y === "number") {
    return Math.min(x, y);
  } else if (x instanceof Quantity && y instanceof Quantity) {
    return x.lessThan(y) ? x : y;
  } else {
    return (x as Dayjs).isBefore(y as Dayjs) ? x : y;
  }
}

/** Returns the larger of the two inputs */
export function qdnMax(x: number, y: number): number;
export function qdnMax(x: Quantity, y: Quantity): Quantity;
export function qdnMax(x: Dayjs, y: Dayjs): Dayjs;
export function qdnMax(
  x: number | Quantity | Dayjs,
  y: number | Quantity | Dayjs
): number | Quantity | Dayjs {
  if (typeof x === "number" && typeof y === "number") {
    return Math.max(x, y);
  } else if (x instanceof Quantity && y instanceof Quantity) {
    return x.greaterThan(y) ? x : y;
  } else {
    return (x as Dayjs).isAfter(y as Dayjs) ? x : y;
  }
}

export function unitEqual(
  a: Unit | NumericDateFormat | undefined,
  b: Unit | NumericDateFormat | undefined
): boolean {
  if (a === undefined) return b === undefined;
  if (a instanceof NumericDateFormat !== b instanceof NumericDateFormat)
    return false;
  return a.isEqual(b as any);
}
