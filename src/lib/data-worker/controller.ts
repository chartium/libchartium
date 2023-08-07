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
import { mapOpt } from "../../utils/mapOpt.ts";

import type {
  Range,
  Size,
  TraceHandle,
  TraceMetas,
  Point,
  TypedArray,
  TypeOfData,
} from "../types.js";
import type { RenderingController } from "./renderers/mod.ts";
import { WebGL2Controller } from "./renderers/webgl2.ts";
import { proxyMarker } from "comlink";

let wasmMemory: WebAssembly.Memory | undefined;

declare class WorkerGlobalScope {}
const isRunningInWorker = () =>
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let instance: ChartiumController | undefined;

export type RenderingMode = "webgl2";

export interface ChartiumControllerOptions {
  /**
   * So far, only WebGL 2 is supported. We will add a WebGPU mode in the future.
   * It is also not impossible that we will introduce a 2D mode for legacy platforms.
   */
  renderingMode?: RenderingMode;
}

export class ChartiumController {
  [proxyMarker] = true;

  #dataModule!: lib.DataModule;
  #traceIds = new BiMap<TraceHandle, string>();
  #canvas: OffscreenCanvas = new OffscreenCanvas(640, 480);
  #renderingController!: RenderingController;

  static instantiateInThisThread(
    options: ChartiumControllerOptions = {}
  ): ChartiumController {
    return new ChartiumController(options);
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

      this.#dataModule = new lib.DataModule();

      switch (options.renderingMode ?? "webgl2") {
        case "webgl2":
          this.#renderingController = new WebGL2Controller(
            this.#dataModule,
            this.#canvas
          );
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

  // public async createRendererRaw(
  //   canvas: OffscreenCanvas,
  //   options?: RendererOptions
  // ): Promise<RawRendererHandle> {
  //   await this.initialized;

  //   const opts = new lib.RendererOptions(options?.area_chart ?? false);

  //   const renderer = lib.RendererContainer.new_webgl(
  //     this.#canvas,
  //     canvas,
  //     opts
  //   );

  //   const handle = this.#availableRendererHandle++;

  //   return handle as RawRendererHandle;
  // }

  // private _getRenderer(handle: RawRendererHandle) {
  //   return (
  //     this.#renderers[handle] ??
  //     yeet("Renderer with given handle does not exist.")
  //   );
  // }

  // public disposeRenderer(handle: RawRendererHandle) {
  //   if (handle in this.#renderers) {
  //     this.#renderers[handle].free();
  //     delete this.#renderers[handle];
  //   }
  // }

  // public resizeRenderer(handle: RawRendererHandle, size: Size) {
  //   this._getRenderer(handle).size_changed(size.width, size.height);
  // }

  // public async createBundleRaw(
  //   handle: RawRendererHandle,
  //   range: Range,
  //   data: ArrayBuffer
  // ): Promise<RawBundleHandle> {
  //   await this.initialized;

  //   const renderer = this._getRenderer(handle);

  //   return <RawBundleHandle>(
  //     renderer.create_bundle_from_stream(
  //       this.#dataModule,
  //       range.from,
  //       range.to,
  //       new Uint8Array(data)
  //     )
  //   );
  // }

  // public disposeBundle(handle: RawRendererHandle, bundle: RawBundleHandle) {
  //   this._getRenderer(handle).dispose_bundle(bundle);
  // }

  // public rebundle(
  //   handle: RawRendererHandle,
  //   bundle: RawBundleHandle,
  //   toDel: ArrayBuffer,
  //   toAdd: ArrayBuffer,
  //   toMod: ArrayBuffer
  // ) {
  //   const renderer = this._getRenderer(handle);

  //   renderer.rebundle(
  //     this.#dataModule,
  //     bundle,
  //     new Uint8Array(toDel),
  //     new Uint8Array(toAdd),
  //     new Uint8Array(toMod)
  //   );
  // }

  // public async invokeRenderJob() {
  //   throw todo(); // TODO
  // }

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
  }) {
    await this.initialized;

    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: TraceHandle[] = [];

    for (const id of ids) {
      let handle = this.#traceIds.getKey(id);

      if (!handle) {
        handle = this.#dataModule.create_trace(id, xType) as TraceHandle;
        this.#traceIds.set(handle, id);
      }

      handles.push(handle);
    }

    const bulkload = await lib.Bulkloader.from_array(
      new Uint32Array(handles),
      xType,
      yType,
      new Uint8Array(dataBuffer)
    );

    bulkload.apply(this.#dataModule);

    return handles;
  }

  public disposeTrace(handleOrId: string | TraceHandle) {
    const handle =
      typeof handleOrId === "string"
        ? this.#traceIds.getKey(handleOrId)
        : handleOrId;

    if (handle === undefined) return;

    this.#dataModule.dispose_trace(handle);
    this.#traceIds.delete(handle);
  }

  areTracesOverThreshold(
    traces: TraceHandle[],
    from: number,
    to: number,
    thresholdValue: number
  ): boolean[] {
    return this.#dataModule.are_traces_over_threshold(
      Uint32Array.from(traces),
      from,
      to,
      thresholdValue
    )
  }

  areTracesZero(traces: TraceHandle[], from: number, to: number): boolean[] {
    return this.#dataModule.are_traces_zero(
      Uint32Array.from(traces),
      from,
      to
    )
  }

  findTraceClosestToPoint(
    traces: TraceHandle[],
    { x, y }: Point,
    max_dy: number
  ) {
    return this.#dataModule.find_n_closest(
      new Uint32Array(traces),
      x,
      y,
      1,
      max_dy
    )[0];
  }

  findNTracesClosestToPoint(traces: TraceHandle[], n: number, { x, y }: Point) {
    return [
      ...this.#dataModule.find_n_closest(new Uint32Array(traces), x, y, 1),
    ];
  }

  findClosestPointOfTrace(
    handle: TraceHandle,
    { x, y }: Point
  ): Point | undefined {
    return mapOpt(
      this.#dataModule.get_closest_point(handle, x, y),
      ([x, y]) => {
        return { x, y };
      }
    );
  }

  getTraceMetas(handle: TraceHandle, range: Range): TraceMetas;
  getTraceMetas(handles: TraceHandle[], range: Range): TraceMetas[];
  getTraceMetas(
    handle: TraceHandle | TraceHandle[],
    range: Range
  ): TraceMetas | TraceMetas[] {
    if (Array.isArray(handle)) {
      return this.#dataModule.get_multiple_traces_metas(
        new Uint32Array(handle),
        range.from,
        range.to
      );
    } else {
      return this.#dataModule.get_trace_metas(handle, range.from, range.to);
    }
  }
}
