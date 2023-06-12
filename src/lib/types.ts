import type { RendererOptions as lib_RendererOptions } from "../../src-rust/pkg/libchartium.js";

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

export type RendererOptions = Partial<Omit<lib_RendererOptions, "free">>;

export type BulkloadOptions = {
  source: string;
  dataset: string;
  variants?: string[];
  range: Range;
};

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
