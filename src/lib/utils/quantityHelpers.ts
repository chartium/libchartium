/** THelper functions to make the code shorter */

import { Quantity, type Unit } from "../lib/types.js";
import type { Range, NumericRange } from "../lib/types.js";

/** Transforms quantity to just numeric part in selected units. If units === undefined, will return x.value */
export function toNumeric(x: Quantity | number, units?: Unit): number {
  if (typeof x === "number") return x;
  if (units) return x.inUnits(units).value;
  else return x.value;
}

/** Transforms range to numeric range in selected units. If units === undefined, will return range of from.value to.value */
export function toNumericRange(range: Range, units?: Unit): NumericRange {
  return {
    from: toNumeric(range.from, units),
    to: toNumeric(range.to, units),
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
export function toRange(range: Range, units?: Unit): Range {
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
