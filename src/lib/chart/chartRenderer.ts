import { effect, type Signal, type Unsubscriber } from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import type { Range, Size } from "../types.js";
import type { RenderJob } from "../data-worker/renderers/mod.js";
import { toNumericRange } from "../utils/quantityHelpers.js";

export interface ChartRendererProps {
  controller$: Signal<ChartiumController | undefined>;
  offscreenCanvas$: Signal<OffscreenCanvas>;
  canvasSize$: Signal<Size>;

  traces$: Signal<TraceList>;
  xRange$: Signal<Range>;
  yRange$: Signal<Range>;

  defer: (u: Unsubscriber) => void;
}

export const chartRenderer$ = ({
  controller$,
  offscreenCanvas$,
  canvasSize$,
  traces$,
  xRange$,
  yRange$,
  defer,
}: ChartRendererProps) => {
  // create a renderer
  const renderer$ = controller$.flatMap((controller) =>
    offscreenCanvas$
      .map((canvas) => controller?.createRenderer(canvas))
      .awaited()
      .currentlyFulfilled(),
  );

  // TODO destroy the renderer

  // reactively re-render
  effect(($) => {
    const renderer = $(renderer$);
    if (renderer === undefined) return;

    const { width, height } = $(canvasSize$);
    $(renderer$)?.setSize(width, height);

    let firstRun = true;
    for (const [units, traces] of $(traces$).getUnitsToTraceMap()) {
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
