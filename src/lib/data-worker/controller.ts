import { BiMap } from "bim";

import wasmUrl from "../../src-rust/pkg/libchartium_bg.wasm?url";
import init, * as lib from "../../../src-rust/pkg/libchartium.js";
import type {
  BulkloadOptions,
  RawBundleHandle,
  Range,
  RawRendererHandle,
  RendererOptions,
  Size,
  RawTraceHandle,
  TraceMetas,
  Point,
} from "../types.js";
import { todo, yeet } from "../../utils/yeet.js";
import { mapOpt } from "../../utils/mapOpt.js";

let wasmMemory: WebAssembly.Memory | undefined;

declare class WorkerGlobalScope {}
const isRunningInWorker = () =>
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let instance: ChartiumController | undefined;

export class ChartiumController {
  private dataModule!: lib.DataModule;
  private availableRendererHandle = 0;
  private renderers: { [key: number]: lib.RendererContainer } = {};
  private traceIds = new BiMap<RawTraceHandle, string>();
  private sharedCanvas: OffscreenCanvas = new OffscreenCanvas(640, 480);

  static async instantiateInThisThread(): Promise<ChartiumController> {
    if (!wasmMemory) {
      wasmMemory = (await init(wasmUrl)).memory;
      lib.set_panic_hook();

      console.log(
        `Loaded WASM ${
          isRunningInWorker() ? "in a worker!" : "on the main thread!"
        }`
      );
    }
    return new ChartiumController();
  }

  private constructor() {
    if (instance) return instance;

    if (!wasmMemory) {
      throw new Error(
        "Attempted to construct ChartiumController while WASM was not loaded yet."
      );
    }

    this.dataModule = new lib.DataModule();
    instance = this;
  }

  get memoryUsage() {
    return wasmMemory?.buffer.byteLength ?? 0;
  }

  get screenSize(): Size {
    const t = this;
    return {
      get width() {
        return t.sharedCanvas.width;
      },
      set width(w) {
        t.sharedCanvas.width = w;
      },
      get height() {
        return t.sharedCanvas.height;
      },
      set height(h) {
        t.sharedCanvas.height = h;
      },
    };
  }
  set screenSize({ width, height }: Size) {
    this.sharedCanvas.width = width;
    this.sharedCanvas.height = height;
  }

  public async createRendererRaw(
    canvas: OffscreenCanvas,
    options?: RendererOptions
  ): Promise<RawRendererHandle> {
    const opts = new lib.RendererOptions(options?.area_chart ?? false);

    const renderer = lib.RendererContainer.new_webgl(
      this.sharedCanvas,
      canvas,
      opts
    );

    const handle = this.availableRendererHandle++;

    return handle as RawRendererHandle;
  }

  private _getRenderer(handle: RawRendererHandle) {
    return (
      this.renderers[handle] ??
      yeet("Renderer with given handle does not exist.")
    );
  }

  public disposeRenderer(handle: RawRendererHandle) {
    if (handle in this.renderers) {
      this.renderers[handle].free();
      delete this.renderers[handle];
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
        this.dataModule,
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
      this.dataModule,
      bundle,
      new Uint8Array(toDel),
      new Uint8Array(toAdd),
      new Uint8Array(toMod)
    );
  }

  public async invokeRenderJob() {
    throw todo(); // TODO
  }

  public async bulkload({ dataset, range, source, variants }: BulkloadOptions) {
    throw todo(); // TODO
  }

  public disposeTrace(handleOrId: string | RawTraceHandle) {
    const handle =
      typeof handleOrId === "string"
        ? this.traceIds.getKey(handleOrId) ?? -1
        : handleOrId;

    this.dataModule.dispose_trace(handle);
    this.traceIds.delete(handle);
  }

  areTracesOverThreshold(
    traces: RawTraceHandle[],
    from: number,
    to: number,
    thresholdValue: number
  ): boolean[] {
    // FIXME move the map to Rust
    return traces.map((t) =>
      this.dataModule.treshold(t, from, to, thresholdValue)
    );
  }

  areTracesZero(traces: RawTraceHandle[], from: number, to: number): boolean[] {
    // FIXME move the map to Rust
    return traces.map((t) => this.dataModule.is_zero(t, from, to));
  }

  findTraceClosestToPoint(
    traces: RawTraceHandle[],
    { x, y }: Point,
    max_dy: number
  ) {
    return this.dataModule.find_closest(new Uint32Array(traces), x, y, max_dy);
  }

  findNTracesClosestToPoint(
    traces: RawTraceHandle[],
    n: number,
    { x, y }: Point,
  ) {}

  findClosestPointOfTrace(handle: RawTraceHandle, { x, y }: Point): Point | undefined {
    return mapOpt(this.dataModule.get_closest_point(handle, x, y), ([x, y]) => {
      return { x, y };
    });
  }

  getTraceMetas(handle: RawTraceHandle, range: Range): TraceMetas;
  getTraceMetas(handles: RawTraceHandle[], range: Range): TraceMetas[];
  getTraceMetas(
    handle: RawTraceHandle | RawTraceHandle[],
    range: Range
  ): TraceMetas | TraceMetas[] {
    if (Array.isArray(handle)) {
      return this.dataModule.get_multiple_traces_metas(
        new Uint32Array(handle),
        range.from,
        range.to
      );
    } else {
      return this.dataModule.get_trace_metas(handle, range.from, range.to);
    }
  }
}
