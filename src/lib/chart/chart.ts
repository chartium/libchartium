import { Defer, type DeferLike, type Signal } from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../index.js";
import { axis$, type Axis } from "./axis.js";
import { chartCanvas$ } from "./chartCanvas.js";
import { chartRenderer$ } from "./chartRenderer.js";
import type { TextMeasuringFunction } from "./axisTicks.js";
import {
  chartAffineSpace,
  type PointInChartFactory,
  type ValueOnAxisFactory,
} from "./chartAffineSpace.js";
import type { DisplayUnitPreference } from "../types.js";

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

  defer: DeferLike;
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
  controller$,
  canvas$,
  visibleTraces$,
  measureXAxisTextSize$,
  measureYAxisTextSize$,
  showXAxisZero$,
  showYAxisZero$,
  xAxisDisplayUnitPreference$,
  yAxisDisplayUnitPreference$,
  defer,
}: ChartProps): Chart => {
  return sanitizedChart$({
    // await uninitialized controllers
    // TODO remove once we change uninitialized Controller to Promise<Controller>
    controller$: controller$
      .skipEqual()
      .map(async (controller) => {
        await controller?.initialized;
        return controller;
      })
      .awaited()
      .currentlyFulfilled(),

    canvas$: canvas$.skipEqual(),
    visibleTraces$: visibleTraces$.skipEqual(),

    measureXAxisTextSize$,
    measureYAxisTextSize$,
    showXAxisZero$,
    showYAxisZero$,
    xAxisDisplayUnitPreference$,
    yAxisDisplayUnitPreference$,

    defer: Defer.from(defer),
  });
};

const sanitizedChart$ = ({
  controller$,
  canvas$,
  visibleTraces$,
  measureXAxisTextSize$,
  measureYAxisTextSize$,
  showXAxisZero$,
  showYAxisZero$,
  xAxisDisplayUnitPreference$,
  yAxisDisplayUnitPreference$,
  defer,
}: ChartProps & { defer: Defer }): Chart => {
  const resetAllRanges = () => {
    axes.x.resetRange();
    axes.y.resetRange();
  };
  const { canvasLogicalSize$, offscreenCanvas$ } = chartCanvas$({
    canvas$,
  });

  const axes = {
    x: axis$({
      axis: "x",
      visibleTraces$,
      lengthInPx$: canvasLogicalSize$.map((size) => size?.width),
      measureTextSize$: measureXAxisTextSize$,
      displayUnitPreference$: xAxisDisplayUnitPreference$,
      showZero$: showXAxisZero$,
      resetAllRanges,
    }),
    y: axis$({
      axis: "y",
      visibleTraces$,
      lengthInPx$: canvasLogicalSize$.map((size) => size?.height),
      measureTextSize$: measureYAxisTextSize$,
      displayUnitPreference$: yAxisDisplayUnitPreference$,
      showZero$: showYAxisZero$,
      resetAllRanges,
    }),
  };

  const { point, valueOnAxis } = chartAffineSpace({
    canvasLogicalSize$,
    xRange$: axes.x.range$,
    yRange$: axes.y.range$,
  });

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
