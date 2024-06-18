import { isNumericDateRepresentation } from "../utils/numericDateRepresentation.js";
import {
  Quantity,
  isQuantity,
  isRange,
  isUnit,
  type ChartRange,
  type DataUnit,
  type ChartValue,
  type DisplayUnit,
} from "../types.js";
import { SI } from "unitlib/systems";
import { isDayjs, type Dayjs, dayjs } from "../utils/dayjs.js";
import { isDateFormat } from "../utils/dateFormat.js";
import { isDuration, Duration } from "../utils/duration.js";

export function eq(
  a: ChartValue | DataUnit | DisplayUnit | Duration | ChartRange | undefined,
  b: ChartValue | DataUnit | DisplayUnit | Duration | ChartRange | undefined,
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
