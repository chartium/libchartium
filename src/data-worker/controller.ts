import wasmUrl from "../../src-rust/pkg/libchartium_bg.wasm?url";
import init, * as lib from "../../src-rust/pkg/libchartium.js";
import type {
  BulkloadOptions,
  BundleHandle,
  Range,
  RendererHandle,
  RendererOptions,
  Size,
} from "../types.js";
import { todo, yeet } from "../utils/yeet.js";

let wasmMemory: WebAssembly.Memory | undefined;

declare class WorkerGlobalScope {}
const isRunningInWorker = () =>
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let instance: ChartiumController | undefined;

export class ChartiumController {
  private dataModule: lib.DataModule;
  private availableRendererHandle = 0;
  private renderers: { [key: number]: lib.RendererContainer } = {};
  private traces: { [key: string]: number } = {};
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

  public async createRenderer(
    canvas: OffscreenCanvas,
    options?: RendererOptions
  ): Promise<RendererHandle> {
    const opts = new lib.RendererOptions(options?.area_chart ?? false);

    const renderer = lib.RendererContainer.new_webgl(
      this.sharedCanvas,
      canvas,
      opts
    );

    const handle = this.availableRendererHandle++;

    return handle as RendererHandle;
  }

  private _getRenderer(handle: RendererHandle) {
    return (
      this.renderers[handle] ??
      yeet("Renderer with given handle does not exist.")
    );
  }

  public disposeRenderer(handle: RendererHandle) {
    if (handle in this.renderers) {
      this.renderers[handle].free();
      delete this.renderers[handle];
    }
  }

  public createBundle(
    handle: RendererHandle,
    range: Range,
    data: ArrayBuffer
  ): BundleHandle {
    const renderer = this._getRenderer(handle);

    return <BundleHandle>(
      renderer.create_bundle_from_stream(
        this.dataModule,
        range.from,
        range.to,
        new Uint8Array(data)
      )
    );
  }

  public disposeBundle(handle: RendererHandle, bundle: BundleHandle) {
    this._getRenderer(handle).dispose_bundle(bundle);
  }

  public rebundle(
    handle: RendererHandle,
    bundle: BundleHandle,
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
}
