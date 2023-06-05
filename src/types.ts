import type { RendererOptions as lib_RendererOptions } from "../src-rust/pkg/libchartium.js";

export interface Size {
  width: number;
  height: number;
}

export interface Range {
  from: number;
  to: number;
}

export type RendererOptions = Partial<Omit<lib_RendererOptions, "free">>;

export type BulkloadOptions = {
  source: string;
  dataset: string;
  variants?: string[];
  range: Range;
};

// Handles

type Handle<S extends string> = number & { __handleType: S };
export type RendererHandle = Handle<"Renderer">;
export type BundleHandle = Handle<"Bundle">;
