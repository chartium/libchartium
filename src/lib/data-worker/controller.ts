import { BiMap } from "bim";

import wasmUrl from "../../../src-rust/pkg/libchartium_bg.wasm?url";
import init, * as lib from "../../../src-rust/pkg/libchartium.js";
import type {
  RawBundleHandle,
  Range,
  RawRendererHandle,
  RendererOptions,
  Size,
  RawTraceHandle,
  TraceMetas,
  Point,
  TypedArray,
  TypeOfData,
} from "../types.js";
import { todo, yeet } from "../../utils/yeet.js";
import { mapOpt } from "../../utils/mapOpt.js";

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
  #dataModule!: lib.DataModule;
  #availableRendererHandle = 0;
  #renderers: { [key: number]: lib.RendererContainer } = {};
  #traceIds = new BiMap<RawTraceHandle, string>();
  #canvas: OffscreenCanvas = new OffscreenCanvas(640, 480);
  #renderingMode: RenderingMode;
  #context: WebGL2RenderingContext;

  static async instantiateInThisThread(
    options: ChartiumControllerOptions = {}
  ): Promise<ChartiumController> {
    if (!wasmMemory) {
      wasmMemory = (await init(wasmUrl)).memory;
      lib.set_panic_hook();

      console.log(
        `Loaded Chartium WASM ${
          isRunningInWorker() ? "in a worker!" : "on the main thread!"
        }`
      );
    }
    return new ChartiumController(options);
  }

  private constructor(options: ChartiumControllerOptions = {}) {
    if (instance) {
      throw new Error(
        "There already is a ChartiumController instance running in this thread."
      );
    }

    if (!wasmMemory) {
      throw new Error(
        "Attempted to construct ChartiumController while WASM was not loaded yet."
      );
    }

    this.#renderingMode = options.renderingMode ?? "webgl2";
    this.#context =
      this.#canvas.getContext(this.#renderingMode, {
        antialias: true,
        premultipliedAlpha: true,
      }) ?? yeet("Could not get a WebGL2 context for an OffscreenCanvas.");

    this.#dataModule = new lib.DataModule();
    instance = this;
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

  public async createRendererRaw(
    canvas: OffscreenCanvas,
    options?: RendererOptions
  ): Promise<RawRendererHandle> {
    const opts = new lib.RendererOptions(options?.area_chart ?? false);

    const renderer = lib.RendererContainer.new_webgl(
      this.#canvas,
      canvas,
      opts
    );

    const handle = this.#availableRendererHandle++;

    return handle as RawRendererHandle;
  }

  private _getRenderer(handle: RawRendererHandle) {
    return (
      this.#renderers[handle] ??
      yeet("Renderer with given handle does not exist.")
    );
  }

  public disposeRenderer(handle: RawRendererHandle) {
    if (handle in this.#renderers) {
      this.#renderers[handle].free();
      delete this.#renderers[handle];
    }
  }

  public resizeRenderer(handle: RawRendererHandle, size: Size) {
    this._getRenderer(handle).size_changed(size.width, size.height);
  }

  public createBundleRaw(
    handle: RawRendererHandle,
    range: Range,
    data: ArrayBuffer
  ): RawBundleHandle {
    const renderer = this._getRenderer(handle);

    return <RawBundleHandle>(
      renderer.create_bundle_from_stream(
        this.#dataModule,
        range.from,
        range.to,
        new Uint8Array(data)
      )
    );
  }

  public disposeBundle(handle: RawRendererHandle, bundle: RawBundleHandle) {
    this._getRenderer(handle).dispose_bundle(bundle);
  }

  public rebundle(
    handle: RawRendererHandle,
    bundle: RawBundleHandle,
    toDel: ArrayBuffer,
    toAdd: ArrayBuffer,
    toMod: ArrayBuffer
  ) {
    const renderer = this._getRenderer(handle);

    renderer.rebundle(
      this.#dataModule,
      bundle,
      new Uint8Array(toDel),
      new Uint8Array(toAdd),
      new Uint8Array(toMod)
    );
  }

  public async invokeRenderJob() {
    throw todo(); // TODO
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
  }) {
    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: RawTraceHandle[] = [];

    for (const id of ids) {
      let handle = this.#traceIds.getKey(id);

      if (!handle) {
        handle = this.#dataModule.create_trace(id, xType) as RawTraceHandle;
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
  }

  public disposeTrace(handleOrId: string | RawTraceHandle) {
    const handle =
      typeof handleOrId === "string"
        ? this.#traceIds.getKey(handleOrId) ?? -1
        : handleOrId;

    this.#dataModule.dispose_trace(handle);
    this.#traceIds.delete(handle);
  }

  areTracesOverThreshold(
    traces: RawTraceHandle[],
    from: number,
    to: number,
    thresholdValue: number
  ): boolean[] {
    // FIXME move the map to Rust
    return traces.map((t) =>
      this.#dataModule.treshold(t, from, to, thresholdValue)
    );
  }

  areTracesZero(traces: RawTraceHandle[], from: number, to: number): boolean[] {
    // FIXME move the map to Rust
    return traces.map((t) => this.#dataModule.is_zero(t, from, to));
  }

  findTraceClosestToPoint(
    traces: RawTraceHandle[],
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

  findNTracesClosestToPoint(
    traces: RawTraceHandle[],
    n: number,
    { x, y }: Point
  ) {
    return [
      ...this.#dataModule.find_n_closest(new Uint32Array(traces), x, y, 1),
    ];
  }

  findClosestPointOfTrace(
    handle: RawTraceHandle,
    { x, y }: Point
  ): Point | undefined {
    return mapOpt(
      this.#dataModule.get_closest_point(handle, x, y),
      ([x, y]) => {
        return { x, y };
      }
    );
  }

  getTraceMetas(handle: RawTraceHandle, range: Range): TraceMetas;
  getTraceMetas(handles: RawTraceHandle[], range: Range): TraceMetas[];
  getTraceMetas(
    handle: RawTraceHandle | RawTraceHandle[],
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
