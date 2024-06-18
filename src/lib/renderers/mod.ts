import type { TraceList } from "../data/trace-list.js";
import type { ChartRange } from "../types.js";

import { createRenderer as createWebgl2Renderer } from "../renderers/webgl2.js";

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

export type RenderingMode = "webgl2";

/**
 * Creates a low level chart renderer. For a more high level approach
 * to rendering, use the Chart component.
 */
export function createRenderer(
  presentCanvas: OffscreenCanvas,
  renderingMode: RenderingMode = "webgl2",
): Renderer {
  switch (renderingMode) {
    case "webgl2":
      return createWebgl2Renderer(presentCanvas);
  }
}
