import type { TraceList } from "../trace-list";
import type { Range, TypeOfData } from "../../types";

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
  renderAxes?: boolean;
}

export interface RenderJobResult {}
