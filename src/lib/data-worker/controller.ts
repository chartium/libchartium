/**
 * 𝑪𝑶𝑵𝑻𝑹𝑶𝑳𝑳𝑬𝑹
 *
 * This is the JavaScript singleton class, which runs in
 * a worker and owns and operates essentially all the data
 * in the worker. It is responsible for the initialization
 * of the WebAssembly part of the codebase, and provides a
 * higher level abstraction above it.
 */

import { BiMap } from "@risai/bim";
import { lib } from "./wasm.js";

import type {
  DataUnit,
  Range,
  Size,
  TraceHandle,
  TraceHandleArray,
  TypedArray,
  TypeOfData,
} from "../types.js";
import { CONSTRUCTOR, randomUint, TraceList } from "./trace-list.js";
import type { TraceStylesheet } from "../index.js";
import { enumerate } from "../utils/collection.js";
import { Bundle } from "./bundle.js";
import { toNumericRange, toRange } from "../utils/unit.js";
import { oxidizeStyleSheet } from "./trace-styles.js";
import { createRenderer as createWebgl2Renderer } from "./renderers/webgl2/mod.js";
import type { Renderer } from "./renderers/mod.js";

export type RenderingMode = "webgl2";

export const traceIds = new BiMap<TraceHandle, string>();

let nextTraceHandle: TraceHandle = 1;
export function registerNewTraceHandle(id: string): TraceHandle {
  const handle = nextTraceHandle++;
  traceIds.set(handle, id);
  return handle;
}

// TODO remove this class, it only acts as a namespace
export class ChartiumController {
  /**
   * Creates a low level chart renderer. For a more high level approach
   * to rendering, use the Chart component.
   */
  public createRenderer(
    presentCanvas: OffscreenCanvas,
    renderingMode: RenderingMode = "webgl2",
  ): Renderer {
    switch (renderingMode) {
      case "webgl2":
        return createWebgl2Renderer(presentCanvas);
    }
  }

  // TODO add better documentation
  // TODO add a function for streamed download
  /**
   * Upload new trace data in the "vertical" order, ie. `[ x[0], y1[0], y2[0], ... x[1], y1[1], y2[1], ...]`.
   */
  public async addFromArrayBuffer({
    ids,
    data,
    xType,
    yType,
    xDataUnit,
    yDataUnit,
    style,
    labels,
  }: {
    ids: string[];
    data: ArrayBuffer | TypedArray;
    xType: TypeOfData;
    yType: TypeOfData;
    xDataUnit?: DataUnit;
    yDataUnit?: DataUnit;
    style?: TraceStylesheet;
    labels?: Iterable<[string, string | undefined]>;
  }): Promise<TraceList> {
    if (ids.length === 0) return TraceList.empty();

    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: TraceHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      handles[i] = traceIds.getKey(id) ?? registerNewTraceHandle(id);
    }

    const bulkload = await lib.Bulkloader.from_array(
      handles,
      xType,
      yType,
      new Uint8Array(dataBuffer),
    );

    const bundle = bulkload.apply();
    const range = bundle.range();
    if (range.type === "Everywhere") {
      throw Error("Unexpected error while parsing the trace list's range.");
    }

    let tl = TraceList[CONSTRUCTOR]({
      handles,
      range: toRange(range.value, xDataUnit),
      rangeArbitrary: false,
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);
    return tl;
  }

  /**
   * Upload new trace data in the "horizontal" (columnar) order.
   */
  public async addFromColumnarArrayBuffers({
    x,
    y,
    style,
    labels,
  }: {
    x: {
      type: TypeOfData;
      unit?: DataUnit;
      data: ArrayBuffer | TypedArray;
    };
    y: {
      type: TypeOfData;
      unit?: DataUnit;
      columns: {
        id: string;
        data: ArrayBuffer | TypedArray;
      }[];
    };
    style?: TraceStylesheet;
    labels?: Iterable<[string, string | undefined]>;
  }): Promise<TraceList> {
    if (y.columns.length === 0) return TraceList.empty();

    const xBuffer = new Uint8Array(
      x.data instanceof ArrayBuffer ? x.data : x.data.buffer,
    );
    const yBuffers = y.columns.map(
      ({ data }) =>
        new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer),
    );

    const handles: TraceHandleArray = new Uint32Array(y.columns.length);

    for (const [i, { id }] of enumerate(y.columns)) {
      handles[i] = traceIds.getKey(id) ?? registerNewTraceHandle(id);
    }

    const bundle = lib.Bulkloader.from_columnar(
      handles,
      x.type,
      y.type,
      xBuffer,
      yBuffers,
    );

    const range = bundle.range();
    if (range.type === "Everywhere") {
      throw Error("Unexpected error while parsing the trace list's range.");
    }

    let tl = TraceList[CONSTRUCTOR]({
      handles,
      range: toRange(range.value, x.unit),
      rangeArbitrary: false,
      bundles: [new Bundle(bundle, x.unit, y.unit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit: x.unit,
      yDataUnit: y.unit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);

    return tl;
  }

  public async addThresholdTracelist({
    ids,
    ys,
    xDataUnit,
    yDataUnit,
    style,
    labels,
    tracelistsRange,
  }: {
    ids: string[];
    ys: Float64Array;
    xDataUnit?: DataUnit;
    yDataUnit?: DataUnit;
    style?: TraceStylesheet;
    labels?: Iterable<[string, string | undefined]>;
    tracelistsRange: Range;
  }): Promise<TraceList> {
    if (ids.length === 0) return TraceList.empty();

    const handles: TraceHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      handles[i] = traceIds.getKey(id) ?? registerNewTraceHandle(id);
    }

    const bundle = lib.Bulkloader.threshold_from_array(handles, ys);

    // assert range's units are compatible with xDataUnit
    toNumericRange(tracelistsRange, xDataUnit);

    let tl = TraceList[CONSTRUCTOR]({
      handles,
      range: tracelistsRange,
      rangeArbitrary: true,
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      styles: oxidizeStyleSheet(style),
      labels: new Map(),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);

    return tl;
  }
}
