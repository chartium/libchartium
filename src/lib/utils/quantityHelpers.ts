/** THelper functions to make the code shorter */

import dayjs from "dayjs";
import {
  Quantity,
  type NumericRange,
  type Unit,
  type Range,
  type QuantityRange,
  type DateRange,
} from "../types.js";

/** Transforms quantity to just numeric part in selected units. If units === undefined, will return x.value. If input is Date, will return unix minutes */
export function toNumeric(
  x: Quantity | number | dayjs.Dayjs,
  units?: Unit | "date"
): number {
  if (x instanceof dayjs) return (x as dayjs.Dayjs).unix() / 60; // NOTE rust works in unix *minutes*
  if (units === "date") {
    if (x instanceof Quantity)
      throw new Error(
        "Can't convert quantity to numeric when units are 'date'"
      );
    return x as number;
  }
  if (typeof x === "number") return x;
  if (units) return (x as Quantity).inUnits(units).value;
  else return (x as Quantity).value;
}

/** Transforms range to numeric range in selected units. If units === undefined, will return range of from.value to.value */
export function toNumericRange(range: Range, units?: Unit): NumericRange {
  return {
    from: toNumeric(range.from, units),
    to: toNumeric(range.to, units),
  };
}

export function toDayjs(x: dayjs.Dayjs | number): dayjs.Dayjs {
  if (typeof x === "number") return dayjs.unix(x * 60);
  else return x;
}

export function toDateRange(range: NumericRange | DateRange): DateRange {
  return {
    from: toDayjs(range.from),
    to: toDayjs(range.to),
  };
}

/** Returns quantity if units are defined, otherwise returns number
 *
 * if input is quantity, will convert units
 */
export function toQuantity(
  x: number | Quantity,
  units?: Unit
): Quantity | number {
  if (x instanceof Quantity && units) return x.inUnits(units);
  if (typeof x === "number" && units) return new Quantity(x, units);
  else return x;
}

/** Returns range in units if defined, otherwise returns numeric range */
export function toQuantityRange(
  range: NumericRange | QuantityRange,
  units?: Unit
): Range {
  return {
    from: toQuantity(range.from, units),
    to: toQuantity(range.to, units),
  } as Range;
}

/** returns x.a + x.b */
export function qnAdd(
  x: { a: number; b: number } | { a: Quantity; b: Quantity }
): number | Quantity {
  if (typeof x.a === "number" && typeof x.b === "number") return x.a + x.b;
  else if (x.a instanceof Quantity && x.b instanceof Quantity)
    return x.a.add(x.b);
  else
    throw new Error("This is literally impossible, but TS doesn't know that");
}

/** returns x.a - x.b */
export function qnSubtract(
  x: { a: number; b: number } | { a: Quantity; b: Quantity }
): number | Quantity {
  if (typeof x.a === "number" && typeof x.b === "number") return x.a - x.b;
  else if (x.a instanceof Quantity && x.b instanceof Quantity)
    return x.a.subtract(x.b);
  else
    throw new Error("This is literally impossible, but TS doesn't know that");
}
