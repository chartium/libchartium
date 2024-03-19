import { cons, type Signal, type Unsubscriber } from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import { axis$, type Axis } from "./axis.js";
import { chartCanvas$ } from "./chartCanvas.js";
import { chartRenderer$ } from "./chartRenderer.js";

export interface ChartProps {
  controller$: Signal<ChartiumController | undefined>;
  canvas$: Signal<HTMLCanvasElement>;

  traces$: Signal<TraceList>;

  measureXAxisTextSize$: Signal<(text: string) => number>;
  measureYAxisTextSize$: Signal<(text: string) => number>;

  defer: (u: Unsubscriber) => void;
}

export interface Chart {
  axes: {
    x: Axis;
    y: Axis;
  };
}

export const chart$ = ({
  controller$,
  canvas$,
  traces$,
  measureXAxisTextSize$,
  measureYAxisTextSize$,
  defer,
}: ChartProps): Chart => {
  const resetAllRanges = () => {
    axes.x.resetRange();
    axes.y.resetRange();
  };
  const axes = {
    x: axis$({
      axis: "x",
      traces$,
      measureTextSize$: measureXAxisTextSize$,
      lengthInPx$: cons(100),
      displayUnitPreference$: cons("auto"),
      resetAllRanges,
      showZero$: cons(false),
    }),
    y: axis$({
      axis: "y",
      traces$,
      measureTextSize$: measureYAxisTextSize$,
      lengthInPx$: cons(100),
      displayUnitPreference$: cons("auto"),
      resetAllRanges,
      showZero$: cons(false),
    }),
  };

  const { canvasSize$, offscreenCanvas$ } = chartCanvas$({
    canvas$,
  });

  chartRenderer$({
    controller$,
    canvasSize$,
    offscreenCanvas$,

    traces$,
    xRange$: axes.x.range$,
    yRange$: axes.y.range$,

    defer,
  });

  return { axes };
};
