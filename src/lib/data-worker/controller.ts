/**
 * 𝑪𝑶𝑵𝑻𝑹𝑶𝑳𝑳𝑬𝑹
 *
 * This is the JavaScript singleton class, which runs in
 * a worker and owns and operates essentially all the data
 * in the worker. It is responsible for the inicialization
 * of the WebAssembly part of the codebase, and provides a
 * higher level abstraction above it.
 */

import { BiMap } from "bim";
import { wasmUrl, init, lib } from "./wasm.js";

import type {
  Size,
  TraceHandle,
  TypedArray,
  TypeOfData,
  Unit,
} from "../types.js";
import type { RenderingController } from "./renderers/mod.js";
import { WebGL2Controller } from "./renderers/webgl2.js";
import { proxyMarker } from "comlink";
import { TraceList } from "./trace-list.js";

let wasmMemory: WebAssembly.Memory | undefined;

declare class WorkerGlobalScope {}
const isRunningInWorker = () =>
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let instance: ChartiumController | undefined;

export type RenderingMode = "webgl2";

export const traceIds = new BiMap<TraceHandle, string>();

export interface ChartiumControllerOptions {
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
    options: ChartiumControllerOptions = {}
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
          })
      );
    }

    return ctl;
  }

  public initialized: Promise<true> | true;

  private constructor(options: ChartiumControllerOptions = {}) {
    if (instance) {
      window.location.reload(); // FIXME only for hot reload while debugging
      throw new Error(
        "There already is a ChartiumController instance running in this thread."
      );
    }
    instance = this;

    this.initialized = (async () => {
      wasmMemory = (await init(wasmUrl)).memory;
      lib.set_panic_hook();

      console.log(
        `Loaded Chartium WASM ${
          isRunningInWorker() ? "in a worker!" : "on the main thread!"
        }`
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
  // TODO add a function to upload transposed (horizontal) data
  // TODO add a function for streamed upload
  /**
   * Upload new trace data in the "vertical" order, ie. `[ x[0], y1[0], y2[0], ... x[1], y1[1], y2[1], ...]`.
   */
  public async addFromArrayBuffer({
    ids,
    data,
    xType,
    yType,
  }: {
    ids: string[];
    data: ArrayBuffer | TypedArray;
    xType: TypeOfData;
    yType: TypeOfData;
    xUnit?: Unit;
    yUnit?: Unit;
  }): Promise<TraceList> {
    await this.initialized;

    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: TraceHandle[] = [];

    for (const id of ids) {
      let handle = traceIds.getKey(id);

      if (!handle) {
        handle = this.#getNewTraceHandle();
        traceIds.set(handle, id);
      }

      handles.push(handle);
    }

    const bulkload = await lib.Bulkloader.from_array(
      new Uint32Array(handles),
      xType,
      yType,
      new Uint8Array(dataBuffer)
    );

    const bundle = bulkload.apply();

    return new TraceList(
      handles,
      { from: bundle.from(), to: bundle.to() },
      [bundle],
      null
    );
  }
}
