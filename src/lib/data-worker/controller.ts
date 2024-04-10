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
import { init, lib } from "./wasm.js";

import type {
  DataUnit,
  Range,
  Size,
  TraceHandle,
  TraceHandleArray,
  TypedArray,
  TypeOfData,
} from "../types.js";
import type { RenderingController } from "./renderers/mod.js";
import { WebGL2Controller } from "./renderers/webgl2.js";
import { proxyMarker } from "comlink";
import { CONSTRUCTOR, TraceList } from "./trace-list.js";
import type { TraceStylesheet } from "../index.js";
import { enumerate } from "../utils/collection.js";
import { Bundle } from "./bundle.js";
import { toNumericRange, toRange } from "../utils/unit.js";
import { oxidizeStyleSheet } from "./trace-styles.js";

let wasmMemory: WebAssembly.Memory | undefined;

declare class WorkerGlobalScope {}
const isRunningInWorker = () =>
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let instance: ChartiumController | undefined;

export type RenderingMode = "webgl2";

export const traceIds = new BiMap<TraceHandle, string>();

export interface ChartiumControllerOptions {
  /**
   * Path to libchartium/wasm.
   */
  wasmUrl: URL | string;

  /**
   * So far, only WebGL 2 is supported. We will add a WebGPU mode in the future.
   * It is also not impossible that we will introduce a 2D mode for legacy platforms.
   */
  renderingMode?: RenderingMode;
}

export class ChartiumController {
  [proxyMarker] = true;

  #nextTraceHandle = 1 as TraceHandle;
  #getNewTraceHandle() {
    return this.#nextTraceHandle++ as TraceHandle;
  }

  #canvas: OffscreenCanvas = new OffscreenCanvas(640, 480);
  #renderingController!: RenderingController;

  static instantiateInThisThread(
    options: ChartiumControllerOptions,
  ): ChartiumController {
    const ctl = new ChartiumController(options);

    if (window) {
      ctl.screenSize = {
        width: innerWidth * devicePixelRatio,
        height: innerHeight * devicePixelRatio,
      };

      /**
       * FIXME currently, the canvas reflects the screen size. this means
       * that the worker is coupled with the browser window, and that it's
       * impossible to draw a chart that is larger than the window (this
       * causes problems when the user zooms in, for example).
       *
       * instead, we should scale the canvas to fit the largest renderer
       */
      window.addEventListener(
        "resize",
        () =>
          (ctl.screenSize = {
            width: innerWidth * devicePixelRatio,
            height: innerHeight * devicePixelRatio,
          }),
      );
    }

    return ctl;
  }

  public initialized: Promise<true> | true;

  private constructor(options: ChartiumControllerOptions) {
    if (instance) {
      window.location.reload(); // FIXME only for hot reload while debugging
      throw new Error(
        "There already is a ChartiumController instance running in this thread.",
      );
    }
    instance = this;

    this.initialized = (async () => {
      wasmMemory = (await init(options.wasmUrl)).memory;
      lib.set_panic_hook();

      console.log(
        `Loaded Chartium WASM ${
          isRunningInWorker() ? "in a worker!" : "on the main thread!"
        }`,
      );

      switch (options.renderingMode ?? "webgl2") {
        case "webgl2":
          this.#renderingController = new WebGL2Controller(this.#canvas);
          break;
      }

      return (this.initialized = <const>true);
    })();
  }

  get memoryUsage() {
    return wasmMemory?.buffer.byteLength ?? 0;
  }

  /** FIXME remove */
  get screenSize(): Size {
    const t = this;
    return {
      get width() {
        return t.#canvas.width;
      },
      set width(w) {
        t.#canvas.width = w;
      },
      get height() {
        return t.#canvas.height;
      },
      set height(h) {
        t.#canvas.height = h;
      },
    };
  }
  set screenSize({ width, height }: Size) {
    this.#canvas.width = width;
    this.#canvas.height = height;
  }

  /**
   * Creates a low level chart renderer. For a more high level approach
   * to rendering, use the Chart component.
   */
  public async createRenderer(presentCanvas: OffscreenCanvas) {
    await this.initialized;
    return this.#renderingController.createRenderer(presentCanvas);
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
    await this.initialized;
    if (ids.length === 0) return TraceList.empty();

    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: TraceHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      let handle = traceIds.getKey(id);

      if (!handle) {
        handle = this.#getNewTraceHandle();
        traceIds.set(handle, id);
      }

      handles[i] = handle;
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
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
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
    await this.initialized;
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
      let handle = traceIds.getKey(id);

      if (!handle) {
        handle = this.#getNewTraceHandle();
        traceIds.set(handle, id);
      }

      handles[i] = handle;
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
      bundles: [new Bundle(bundle, x.unit, y.unit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit: x.unit,
      yDataUnit: y.unit,
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
    await this.initialized;
    if (ids.length === 0) return TraceList.empty();

    const handles: TraceHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      let handle = traceIds.getKey(id);

      if (!handle) {
        handle = this.#getNewTraceHandle();
        traceIds.set(handle, id);
      }

      handles[i] = handle;
    }

    const bundle = lib.Bulkloader.threshold_from_array(handles, ys);

    // assert range's units are compatible with xDataUnit
    toNumericRange(tracelistsRange, xDataUnit);

    let tl = TraceList[CONSTRUCTOR]({
      handles,
      range: tracelistsRange,
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      styles: oxidizeStyleSheet(style),
      labels: new Map(),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
    });

    if (labels) tl = tl.withLabels(labels);

    return tl;
  }
}
