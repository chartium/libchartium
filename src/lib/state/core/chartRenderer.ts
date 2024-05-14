import {
  derived,
  effect,
  type Signal,
  type Unsubscriber,
} from "@mod.js/signals";
import { debounce } from "lodash-es";
import { devicePixelRatio$ } from "../../utils/reactive-globals.js";
import type { ChartiumController, TraceList } from "../../index.js";
import type { Range, Size } from "../../types.js";

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
    offscreenCanvas$.map((canvas) =>
      !canvas ? undefined : controller?.createRenderer(canvas),
    ),
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

  // TODO: find a smarter way to deal with too much reactivity
  const render = debounce(
    (renderer, visibleTraces, xRange, yRange) => {
      renderer.render({
        traces: visibleTraces,
        clear: true,
        xRange: xRange,
        yRange: yRange,
      });
    },
    16,
    { maxWait: 16 },
  );

  // reactively re-render
  effect(($) => {
    const renderer = $(renderer$);
    const size = $(canvasPhysicalSize$);
    if (!renderer || !size) return;

    renderer.setSize(size.width, size.height);

    render(renderer, $(visibleTraces$), $(xRange$), $(yRange$));
  }).pipe(defer);
};
