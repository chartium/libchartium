import { effect, type Signal, type Unsubscriber } from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import type { Range, Size } from "../types.js";
import type { RenderJob } from "../data-worker/renderers/mod.js";
import { toNumericRange } from "../utils/quantityHelpers.js";

export interface ChartRendererProps {
  controller$: Signal<ChartiumController | undefined>;
  offscreenCanvas$: Signal<OffscreenCanvas | undefined>;
  canvasSize$: Signal<Size | undefined>;

  visibleTraces$: Signal<TraceList>;
  xRange$: Signal<Range>;
  yRange$: Signal<Range>;

  defer: (u: Unsubscriber) => void;
}

export const chartRenderer$ = ({
  controller$,
  offscreenCanvas$,
  canvasSize$,
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

  // reactively re-render
  effect(($) => {
    const renderer = $(renderer$);
    const size = $(canvasSize$);
    if (!renderer || !size) return;

    renderer.setSize(size.width, size.height);

    let firstRun = true;
    for (const [units, traces] of $(visibleTraces$).getUnitsToTraceMap()) {
      const clear = firstRun;
      firstRun = false;

      const renderJob: RenderJob = {
        traces,

        // TODO read xType
        xType: "f32",
        xRange: toNumericRange($(xRange$), units.x),
        yRange: toNumericRange($(yRange$), units.y),
        clear,
      };

      renderer.render(renderJob);
    }
  }).pipe(defer);
};
