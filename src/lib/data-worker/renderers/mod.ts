import type { TraceList } from "../trace-list.js";
import type { Range, TypeOfData } from "../../types.js";

export interface RenderingController {
  createRenderer(presentCanvas: OffscreenCanvas): Renderer;
}

export interface Renderer {
  render(job: RenderJob): RenderJobResult;
  setSize(width: number, height: number): void;
}

export interface RenderJob {
  xType: TypeOfData;

  traces: TraceList;

  xRange?: Range;
  yRange?: Range;

  clear?: boolean;
}

export interface RenderJobResult {}
