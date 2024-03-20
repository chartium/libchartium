import { cons, type Signal, type Unsubscriber } from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import { axis$, type Axis, type DisplayUnitPreference } from "./axis.js";
import { chartCanvas$ } from "./chartCanvas.js";
import { chartRenderer$ } from "./chartRenderer.js";
import type { TextMeasuringFunction } from "./axisTicks.js";
import {
  chartAffineSpace,
  type PointInChartFactory,
  type ValueOnAxisFactory,
} from "./chartAffineSpace.js";

export interface ChartProps {
  controller$: Signal<ChartiumController | undefined>;
  canvas$: Signal<HTMLCanvasElement | undefined>;

  visibleTraces$: Signal<TraceList>;

  measureXAxisTextSize$: Signal<TextMeasuringFunction | undefined>;
  measureYAxisTextSize$: Signal<TextMeasuringFunction | undefined>;

  showXAxisZero$: Signal<boolean>;
  showYAxisZero$: Signal<boolean>;
  xAxisDisplayUnitPreference$: Signal<DisplayUnitPreference>;
  yAxisDisplayUnitPreference$: Signal<DisplayUnitPreference>;

  defer: (u: Unsubscriber) => void;
}

export interface Chart {
  axes: {
    x: Axis;
    y: Axis;
  };

  resetAllRanges(): void;

  valueOnAxis(axis: "x" | "y"): ValueOnAxisFactory;
  point(): PointInChartFactory;
}

export const chart$ = ({
  controller$: maybeUninitializedController$,
  canvas$: maybeReassignedCanvas$,
  visibleTraces$,
  measureXAxisTextSize$,
  measureYAxisTextSize$,
  showXAxisZero$,
  showYAxisZero$,
  xAxisDisplayUnitPreference$,
  yAxisDisplayUnitPreference$,
  defer,
}: ChartProps): Chart => {
  const canvas$ = maybeReassignedCanvas$.skipEqual();

  const resetAllRanges = () => {
    axes.x.resetRange();
    axes.y.resetRange();
  };
  const axes = {
    x: axis$({
      axis: "x",
      visibleTraces$,
      lengthInPx$: cons(100),
      measureTextSize$: measureXAxisTextSize$,
      displayUnitPreference$: xAxisDisplayUnitPreference$,
      showZero$: showXAxisZero$,
      resetAllRanges,
    }),
    y: axis$({
      axis: "y",
      visibleTraces$,
      lengthInPx$: cons(100),
      measureTextSize$: measureYAxisTextSize$,
      displayUnitPreference$: yAxisDisplayUnitPreference$,
      showZero$: showYAxisZero$,
      resetAllRanges,
    }),
  };

  const { canvasLogicalSize$, offscreenCanvas$ } = chartCanvas$({
    canvas$,
  });

  const { point, valueOnAxis } = chartAffineSpace({
    canvasSize$: canvasLogicalSize$.map(
      (size) => size ?? { width: NaN, height: NaN },
    ),
    xRange$: axes.x.range$,
    yRange$: axes.y.range$,
  });

  // TODO remove once we change uninitialized Controller to Promise<Controller>
  const controller$ = maybeUninitializedController$
    .map(async (controller) => {
      await controller?.initialized;
      return controller;
    })
    .awaited()
    .currentlyFulfilled();

  chartRenderer$({
    controller$,
    canvasLogicalSize$,
    offscreenCanvas$,

    visibleTraces$,
    xRange$: axes.x.range$,
    yRange$: axes.y.range$,

    defer,
  });

  return { axes, resetAllRanges, point, valueOnAxis };
};
