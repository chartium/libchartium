import { isDayjs, type Dayjs } from "./utils/dayjs.js";

import { Unit as Unit_ } from "unitlib";
export type Unit = Unit_<any, any, any>;
export const Unit = Unit_;
export const isUnit = (x: unknown): x is Unit => x instanceof Unit;

import { Quantity as Quantity_ } from "unitlib";
import { toNumeric } from "./utils/unit.js";
export type Quantity = Quantity_<any, any, any>;
export const Quantity = Quantity_;
export const isQuantity = (x: unknown): x is Quantity => x instanceof Quantity;

import type { NumericDateRepresentation } from "./index.js";
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

export type TraceHandle = number;
export type TraceHandleArray = Uint32Array;

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

export type Range = NumericRange | QuantityRange | DateRange;

export const isRange = (x: unknown): x is Range =>
  typeof x === "object" && x !== null && "from" in x && "to" in x;

export const isNumericRange = (x: unknown): x is NumericRange =>
  isRange(x) && typeof x.from === "number" && typeof x.to === "number";

export const isDateRange = (x: unknown): x is DateRange =>
  isRange(x) &&
  typeof x.from === "object" &&
  typeof x.to === "object" &&
  isDayjs(x.from) &&
  isDayjs(x.to);

export const rangesHaveMeaningfulIntersection = function isect(
  a: Range,
  b: Range,
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

export interface Threshold {
  thresholdFrac: number;
  type: "persistent" | "filtering";
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

export const X = Symbol("x");
export type ExportRow = {
  [X]: number;
  [traceId: string]: number;
};
