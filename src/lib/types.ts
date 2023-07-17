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

export interface Range {
  from: number;
  to: number;
}

export interface Point {
  x: number;
  y: number;
}

// Handles

type RawHandle<S extends string> = number & { __handleType: S };
export type RawRendererHandle = RawHandle<"Renderer"> | -1;
export type RawBundleHandle = RawHandle<"Bundle"> | -1;
export type RawTraceHandle = RawHandle<"Trace"> | -1;

export interface TraceMetas {
  avg: number;
  avg_nz: number;
  min: number;
  max: number;
  in_area?: boolean;

  [key: string]: unknown;
}
