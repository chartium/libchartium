import type { TraceList } from "../trace-list.js";
import type { Range } from "../../types.js";

export interface RenderingController {
  createRenderer(presentCanvas: OffscreenCanvas): Renderer;
}

export interface Renderer {
  render(job: RenderJob): void;
  setSize(width: number, height: number): void;
}

export interface RenderJob {
  traces: TraceList;

  clear: boolean;
  xRange: Range;
  yRange: Range;
}
