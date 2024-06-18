import type { TraceList } from "../data/trace-list.js";
import type { ChartRange } from "../types.js";

export interface Renderer {
  render(job: RenderJob): void;
  setSize(width: number, height: number): void;
}

export interface RenderJob {
  traces: TraceList;

  clear: boolean;
  xRange: ChartRange;
  yRange: ChartRange;
}
