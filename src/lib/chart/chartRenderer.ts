import {
  derived,
  effect,
  type Signal,
  type Unsubscriber,
} from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import type { Range, Size } from "../types.js";
import type { RenderJob } from "../data-worker/renderers/mod.js";
import { toNumericRange } from "../utils/unit.js";
import { devicePixelRatio$ } from "../utils/reactive-globals.js";

export interface ChartRendererProps {
  controller$: Signal<ChartiumController | undefined>;
  offscreenCanvas$: Signal<OffscreenCanvas | undefined>;
  canvasLogicalSize$: Signal<Size | undefined>;

  visibleTraces$: Signal<TraceList>;
  xRange$: Signal<Range>;
  yRange$: Signal<Range>;

  defer: (u: Unsubscriber) => void;
}

export const chartRenderer$ = ({
  controller$,
  offscreenCanvas$,
  canvasLogicalSize$,
  visibleTraces$,
  xRange$,
  yRange$,
  defer,
}: ChartRendererProps) => {
  // create a renderer
  const renderer$ = controller$.flatMap((controller) =>
    offscreenCanvas$
      .map((canvas) =>
        !canvas ? undefined : controller?.createRenderer(canvas),
      )
      .awaited()
      .currentlyFulfilled(),
  );

  // TODO destroy the renderer

  const canvasPhysicalSize$ = derived(($) => {
    const logicalSize = $(canvasLogicalSize$);
    if (!logicalSize) return;
    const { width, height } = logicalSize;
    const zoom = $(devicePixelRatio$);
    return {
      width: width * zoom,
      height: height * zoom,
    };
  });

  // reactively re-render
  effect(($) => {
    const renderer = $(renderer$);
    const size = $(canvasPhysicalSize$);
    if (!renderer || !size) return;

    renderer.setSize(size.width, size.height);

    const traceList = $(visibleTraces$);

    renderer.render({
      traces: $(visibleTraces$),
      clear: true,
      xRange: $(xRange$),
      yRange: $(yRange$),
    });
  }).pipe(defer);
};
