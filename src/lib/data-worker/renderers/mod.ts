import type { Range, TypeOfData } from "../../types";
import type { TraceList } from "../trace-list";

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
  darkMode?: boolean;
  renderAxes?: boolean;
  renderGrid?: boolean;

  margin?: number;
  xLabelSpace?: number;
  yLabelSpace?: number;
}

export interface RenderJobResult {
  xTicks: Array<{
    value: number;
    position: number;
  }>;
  yTicks: Array<{
    value: number;
    position: number;
  }>;
}
