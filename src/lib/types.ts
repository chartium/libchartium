import { isDayjs, type Dayjs } from "./utils/dayjs.js";

import {
  Unit as Unit_,
  isUnit as _isUnit,
  isQuantity as _isQuantity,
} from "unitlib";

export const asAny = (x: any) => x;
export type Unit = Unit_<any, any, any>;
export const Unit = Unit_;
export const isUnit = (x: unknown): x is Unit => _isUnit(x);

import { Quantity as Quantity_ } from "unitlib";
import { toNumeric } from "./units/mod.js";
export type Quantity = Quantity_<any, any, any>;
export const Quantity = Quantity_;
export const isQuantity = (x: unknown): x is Quantity => _isQuantity(x);

import type { NumericDateRepresentation } from "./mod.js";
import type { DateFormat } from "./utils/dateFormat.js";

export type DataUnit = NumericDateRepresentation | Unit | undefined;
export type DisplayUnit = Unit | DateFormat | undefined;
export type DisplayUnitPreference = DisplayUnit | "auto" | "data";

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array
  | Float32Array
  | Float64Array;

export type TypeOfData =
  | "i8"
  | "u8"
  | "i16"
  | "u16"
  | "i32"
  | "u32"
  | "i64"
  | "u64"
  | "f32"
  | "f64";

export type VariantHandle = number;
export type VariantHandleArray = Uint32Array;

export interface Size {
  width: number;
  height: number;
}

export type NumericRange = {
  from: number;
  to: number;
};

export type QuantityRange = {
  from: Quantity;
  to: Quantity;
};

export type DateRange = {
  from: Dayjs;
  to: Dayjs;
};

export type ChartRange = NumericRange | QuantityRange | DateRange;

export const isRange = (x: unknown): x is ChartRange =>
  typeof x === "object" && x !== null && "from" in x && "to" in x;

export const isNumericRange = (x: unknown): x is NumericRange =>
  isRange(x) && typeof x.from === "number" && typeof x.to === "number";

export const isDateRange = (x: unknown): x is DateRange =>
  isRange(x) &&
  typeof x.from === "object" &&
  typeof x.to === "object" &&
  isDayjs(x.from) &&
  isDayjs(x.to);

export const isQuantityRange = (x: unknown): x is QuantityRange =>
  isRange(x) &&
  typeof x.from === "object" &&
  typeof x.to === "object" &&
  isQuantity(x.from) &&
  isQuantity(x.to);

export const isSameRange = (a: ChartRange, b: ChartRange): boolean => {
  if (isNumericRange(a) && isNumericRange(b))
    return a.from === b.from && a.to === b.to;
  if (isDateRange(a) && isDateRange(b))
    return a.from.isSame(b.from) && a.to.isSame(b.to);
  if (isQuantityRange(a) && isQuantityRange(b))
    return a.from.isEqual(b.from) && a.to.isEqual(b.to);
  return false;
};

export const rangesHaveMeaningfulIntersection = function isect(
  a: ChartRange,
  b: ChartRange,
): boolean {
  if (isNumericRange(a)) {
    if (!isNumericRange(b)) return false;
    return a.from < b.to && b.from < a.to;
  }
  if (isDateRange(a)) {
    if (!isDateRange(b)) return false;
    return isect({ from: +a.from, to: +a.to }, { from: +b.from, to: +b.to });
  }
  try {
    const unit = a.from.unit;
    return isect(
      { from: toNumeric(a.from, unit), to: toNumeric(a.to, unit) },
      { from: toNumeric(b.from, unit), to: toNumeric(b.to, unit) },
    );
  } catch {
    return false;
  }
};

/** Shift of ranges as a fraction of the range
 * i.e. moving the [0, 5] by dx = 0.5 would result in [2.5, 7.5]
 */
export interface Shift {
  dx?: number;
  dy?: number;

  origin: Point;
}

/** Ranges x and y are fractions of the full range */
export interface Zoom {
  x: NumericRange;
  y: NumericRange;
}

export interface Point {
  x: number;
  y: number;
}

export type ChartValue = number | Dayjs | Quantity;

export interface HighlightPoint {
  x: ChartValue;
  y: ChartValue;
  color: string;
  radius: number;
}

/**
 * Type for ticks used in graph axis. Position is expected to be between 0 and 1 and denotes at what
 * fraction of axis length/height the tick should be placed.
 */
export interface Tick {
  text: string;
  subtext?: string;
  position: number;
}

/** A type for passing rectangle position by declaring top left and bottom right corners */
export type RectanglePosition =
  | {
      topLeft: Point;
      bottomRight: Point;
    }
  | {
      x: number;
      y: number;
      width: number;
      height: number;
    };
