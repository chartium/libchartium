import { toUint8ColorOrRandom } from "../../../utils/color";
import type { Range, TraceHandle, TraceStyle, TypeOfData } from "../../types";
import { lib } from "../wasm";

export interface RenderingController {
  createRenderer(presentCanvas: OffscreenCanvas): Renderer;
}

export interface Renderer {
  render(job: RenderJob): RenderJobResult;
}

export interface RenderJob {
  xType: TypeOfData;

  includeTraces: Array<{ handle: TraceHandle } & Partial<TraceStyle>>;
  includeBundles: number[];
  excludeTraces: TraceHandle[];

  xRange: Range;
  yRange: Range;

  clear?: boolean;
  darkMode?: boolean;
  renderAxes?: boolean;
  renderGrid?: boolean;

  margin?: number;
  xLabelSpace?: number;
  yLabelSpace?: number;
}

export function deserializeRenderJob(job: RenderJob): lib.RenderJob {
  const rj = new lib.RenderJob(
    job.xType,
    job.includeTraces.length,
    job.includeBundles.length
  );

  rj.x_from = job.xRange.from;
  rj.x_to = job.xRange.to;
  rj.y_from = job.yRange.from;
  rj.y_to = job.yRange.to;

  for (const trace of job.includeTraces) {
    rj.add_trace(
      trace.handle,
      toUint8ColorOrRandom(trace.color),
      trace.width ?? 1,
      trace.pointsMode ?? false
    );
  }

  for (const bundle of job.includeBundles) rj.add_bundle(bundle);
  for (const trace of job.excludeTraces) rj.blacklist_trace(trace);

  if (job.clear !== undefined) rj.clear = job.clear;
  if (job.darkMode !== undefined) rj.dark_mode = job.darkMode;
  if (job.renderAxes !== undefined) rj.render_axes = job.renderAxes;
  if (job.renderGrid !== undefined) rj.render_grid = job.renderGrid;

  return rj;
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
