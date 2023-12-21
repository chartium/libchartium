/** THelper functions to make the code shorter */

import dayjs from "dayjs";
import { NumericDateFormat } from "./numericDateFormat.js";
import {
  Quantity,
  type NumericRange,
  type Unit,
  type Range,
} from "../types.js";

/** Transforms quantity to just numeric part in selected units. */
export function toNumeric(
  x: Quantity | number | dayjs.Dayjs,
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
): Quantity | dayjs.Dayjs | number {
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

/** returns x + xy */
export function qnAdd(x: number, y: number): number;
export function qnAdd(x: Quantity, y: Quantity): Quantity;
export function qnAdd(
  x: number | Quantity,
  y: number | Quantity
): number | Quantity {
  if (typeof x === "number" && typeof y === "number") return x + y;
  else return (x as Quantity).add(x as Quantity);
}

/** returns x - y */
export function qnSubtract(x: number, y: number): number;
export function qnSubtract(x: Quantity, y: Quantity): Quantity;
export function qnSubtract(
  x: number | Quantity,
  y: number | Quantity
): number | Quantity {
  if (typeof x === "number" && typeof y === "number") return x - y;
  else return (x as Quantity).subtract(y as Quantity);
}

/** Returns the smaller of the two inputs */
export function qdnMin(x: number, y: number): number;
export function qdnMin(x: Quantity, y: Quantity): Quantity;
export function qdnMin(x: dayjs.Dayjs, y: dayjs.Dayjs): dayjs.Dayjs;
export function qdnMin(
  x: number | Quantity | dayjs.Dayjs,
  y: number | Quantity | dayjs.Dayjs
): number | Quantity | dayjs.Dayjs {
  if (typeof x === "number" && typeof y === "number") {
    return Math.min(x, y);
  } else if (x instanceof Quantity && y instanceof Quantity) {
    return x.lessThan(y) ? x : y;
  } else {
    return (x as dayjs.Dayjs).isBefore(y as dayjs.Dayjs) ? x : y;
  }
}

/** Returns the larger of the two inputs */
export function qdnMax(x: number, y: number): number;
export function qdnMax(x: Quantity, y: Quantity): Quantity;
export function qdnMax(x: dayjs.Dayjs, y: dayjs.Dayjs): dayjs.Dayjs;
export function qdnMax(
  x: number | Quantity | dayjs.Dayjs,
  y: number | Quantity | dayjs.Dayjs
): number | Quantity | dayjs.Dayjs {
  if (typeof x === "number" && typeof y === "number") {
    return Math.max(x, y);
  } else if (x instanceof Quantity && y instanceof Quantity) {
    return x.greaterThan(y) ? x : y;
  } else {
    return (x as dayjs.Dayjs).isAfter(y as dayjs.Dayjs) ? x : y;
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
