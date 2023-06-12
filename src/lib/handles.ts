import type { Remote } from "comlink";
import type {
  RawBundleHandle,
  RawRendererHandle,
  RawTraceHandle,
  RendererOptions,
  Size,
} from "./types";
import type { ChartiumController } from "./data-worker/controller";
import { todo } from "../utils/yeet";

export class Renderer {
  private constructor(
    public controller: ChartiumController | Remote<ChartiumController>,
    public rawHandle: RawRendererHandle
  ) {}

  static wrapExistingRawHandle(
    controller: ChartiumController | Remote<ChartiumController>,
    rawHandle: RawRendererHandle
  ) {
    return new Renderer(controller, rawHandle);
  }

  static async create(
    controller: ChartiumController | Remote<ChartiumController>,
    canvas: OffscreenCanvas,
    opts?: RendererOptions
  ): Promise<Renderer> {
    return new Renderer(
      controller,
      await controller.createRendererRaw(canvas, opts)
    );
  }

  async dispose(): Promise<void> {
    if (this.rawHandle >= 0) {
      await this.controller.disposeRenderer(this.rawHandle);
      this.rawHandle = -1;
    }
  }

  async resize(size: Size) {
    await this.controller.resizeRenderer(this.rawHandle, size);
  }

  public createJob() {
    throw todo(); // TODO
  }
}

export class Bundle {
  private constructor(
    public renderer: Renderer,
    public rawHandle: RawBundleHandle
  ) {}

  static wrapExistingRawHandle(renderer: Renderer, handle: RawBundleHandle) {
    return new Bundle(renderer, handle);
  }

  async dispose(): Promise<void> {
    if (this.rawHandle >= 0) {
      await this.renderer.controller.disposeBundle(
        this.renderer.rawHandle,
        this.rawHandle
      );
      this.rawHandle = -1;
    }
  }

  rebundle() {
    throw todo(); // TODO
  }
}
