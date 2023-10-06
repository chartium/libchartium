import type { Color } from "./utils/color.js";

import type { Unit as Unit_ } from "unitlib";
export type Unit = Unit_<any, any, any>;

import { Quantity as Quantity_ } from "unitlib";
export type Quantity = Quantity_<any, any, any>;
export const Quantity = Quantity_;

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

export type Range = NumericRange | QuantityRange;

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

export interface HighlightPoint {
  xFraction: number;
  yFraction: number;
  color: Color;
  radius: number;
}

type RawHandle<S extends string> = number & { __handleType: S };
export type TraceHandle = RawHandle<"Trace">;

export interface TraceMetas {
  avg: number;
  avg_nz: number;
  min: number;
  max: number;
  in_area?: boolean;

  [key: string]: unknown;
}

/**
 * Type for ticks used in graph axis. Position is expected to be between 0 and 1 and denotes at what
 * fraction of axis length/height the tick should be placed.
 */
export interface Tick {
  value: number;
  unit: Unit | undefined;
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
