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
export function toQuantOrDay(
  x: number | Quantity | dayjs.Dayjs,
  units?: Unit | "date"
): Quantity | dayjs.Dayjs | number {
  if (dayjs.isDayjs(x) || units === "date") {
    if (x instanceof Quantity)
      throw new Error("Can't convert quantity to date");
    return toDayjs(x);
  }
  if (x instanceof Quantity && units) return x.inUnits(units);
  if (typeof x === "number" && units) return new Quantity(x, units);
  else return x;
}

/** Returns range in units if defined, otherwise returns numeric range */
export function toRange(
  range: NumericRange | QuantityRange | DateRange,
  units?: Unit | "date"
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
    const firstInSecondUnits = x.inUnits(y.unit);
    return firstInSecondUnits.value < (x as Quantity).value ? x : y;
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
    const firstInSecondUnits = x.inUnits(y.unit);
    return firstInSecondUnits.value > (x as Quantity).value ? x : y;
  } else {
    return (x as dayjs.Dayjs).isAfter(y as dayjs.Dayjs) ? x : y;
  }
}
