import {
  derived,
  effect,
  type Signal,
  type Unsubscriber,
} from "@typek/signalhead";
import { devicePixelRatio$ } from "../../utils/reactive-globals.js";
import type { TraceList } from "../../mod.js";
import type { ChartRange, Size } from "../../types.js";
import { createRenderer, type Renderer } from "../../renderers/mod.js";

export interface ChartRendererProps {
  offscreenCanvas$: Signal<OffscreenCanvas | undefined>;
  canvasLogicalSize$: Signal<Size | undefined>;

  visibleTraces$: Signal<TraceList>;
  xRange$: Signal<ChartRange>;
  yRange$: Signal<ChartRange>;

  defer: (u: Unsubscriber) => void;
}

export const chartRenderer$ = ({
  offscreenCanvas$,
  canvasLogicalSize$,
  visibleTraces$,
  xRange$,
  yRange$,
  defer,
}: ChartRendererProps) => {
  // create a renderer
  const renderer$ = offscreenCanvas$.map((canvas) =>
    !canvas ? undefined : createRenderer(canvas),
  );
  // TODO destroy the renderer

  const canvasPhysicalSize$ = derived((S) => {
    const logicalSize = S(canvasLogicalSize$);
    if (!logicalSize) return;
    const { width, height } = logicalSize;
    const zoom = S(devicePixelRatio$);
    return {
      width: width * zoom,
      height: height * zoom,
    };
  });

  const awaitedRenderParams$ = renderer$
    .zip(canvasPhysicalSize$, visibleTraces$, xRange$, yRange$)
    .awaited()
    .currentlyFulfilled();

  const render = (
    renderer: Renderer,
    visibleTraces: TraceList,
    xRange: ChartRange,
    yRange: ChartRange,
  ) => {
    // console.log("render");
    renderer.render({
      traces: visibleTraces,
      clear: true,
      xRange,
      yRange,
    });
  };

  // reactively re-render
  effect((S) => {
    const awaited = S(awaitedRenderParams$);
    if (awaited === undefined) return;
    const [renderer, size, visibleTraces, xRange, yRange] = awaited; // Just a TS issue, will be fixed in next mod.js version
    if (!renderer || !size) return;
    renderer.setSize(size.width, size.height);

    render(renderer, visibleTraces, xRange, yRange);
  }).pipe(defer);
};
