/**
 * 𝑪𝑶𝑵𝑻𝑹𝑶𝑳𝑳𝑬𝑹
 *
 * This is the JavaScript singleton class, which runs in
 * a worker and owns and operates essentially all the data
 * in the worker. It is responsible for the inicialization
 * of the WebAssembly part of the codebase, and provides a
 * higher level abstraction above it.
 *
 * Data ownership schema in controller.excalidraw
 */

import { BiMap } from "bim";
import { wasmUrl, init, lib } from "./wasm.ts";

import type { Size, TraceHandle, TypedArray, TypeOfData } from "../types.js";
import type { RenderingController } from "./renderers/mod.ts";
import { WebGL2Controller } from "./renderers/webgl2.ts";
import { proxyMarker } from "comlink";
import { TraceList } from "./trace-list.ts";

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

      // FIXME: don't forget to destroy this listener when the worker is destroyed
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

  public async createRenderer(presentCanvas: OffscreenCanvas) {
    await this.initialized;
    return this.#renderingController.createRenderer(presentCanvas);
  }

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
      {}
    );
  }
}
