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

export interface Shift {
  dx?: number;
  dy?: number;
}

export interface Zoom {
  x: Range;
  y: Range;
}

export interface Point {
  x: number;
  y: number;
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

/** Type for ticks used in graph axis. Position is expected to be between 0 and 1 and denotes at what
 * fraction of axis length/height the tick should be placed.
 */
export interface Tick {
  value: number;
  position: number;
}

export interface ContextLeaf {
  type: "leaf";
  text: string;
  callback: () => void;
}
export interface ContextBranch {
  type: "branch";
  text: string;
  children: ContextItem[];
}
export interface ContextSeparator {
  type: "separator";
}
/** Type for the context menu
 * context menu is just a list of ContextItems where each can be
 * a leaf with content and callback,
 * a branch, i.e. a submenu,
 * or a separator which is just a line
 */
export type ContextItem = ContextLeaf | ContextBranch | ContextSeparator;

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
