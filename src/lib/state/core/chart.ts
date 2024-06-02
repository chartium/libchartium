import {
  Defer,
  WritableSignal,
  type DeferLike,
  type Signal,
} from "@mod.js/signals";
import type { ChartiumController, TraceList } from "../../index.js";
import { xAxis$, yAxis$, type Axis } from "./axis.js";
import { chartCanvas$ } from "./chartCanvas.js";
import { chartRenderer$ } from "./chartRenderer.js";
import type { TextMeasuringFunction } from "./axisTicks.js";
import {
  chartAffineSpace,
  type PointInChartFactory,
  type ValueOnAxisFactory,
} from "./chartAffineSpace.js";
import type { DisplayUnitPreference, Range } from "../../types.js";

export interface ChartProps {
  controller$: Signal<ChartiumController | undefined>;
  canvas$: Signal<HTMLCanvasElement | undefined>;

  visibleTraces$: Signal<TraceList>;

  measureXAxisTextSize$: Signal<TextMeasuringFunction | undefined>;
  measureYAxisTextSize$: Signal<TextMeasuringFunction | undefined>;

  showXAxisZero$: Signal<boolean>;
  showYAxisZero$: Signal<boolean>;
  autoscaleY$: Signal<boolean>;
  commonXRange$: WritableSignal<Range | undefined>;
  doUseCommonXRange$: Signal<boolean>;
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
  autoscaleY$,
  commonXRange$,
  doUseCommonXRange$,
  xAxisDisplayUnitPreference$,
  yAxisDisplayUnitPreference$,
  defer,
}: ChartProps): Chart => {
  return sanitizedChart$({
    controller$: controller$.skipEqual(),
    canvas$: canvas$.skipEqual(),
    visibleTraces$: visibleTraces$.skipEqual(),

    measureXAxisTextSize$,
    measureYAxisTextSize$,
    showXAxisZero$,
    showYAxisZero$,
    autoscaleY$,
    commonXRange$,
    doUseCommonXRange$,
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
  autoscaleY$,
  commonXRange$,
  doUseCommonXRange$,
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

  const x = xAxis$({
    axis: "x",
    visibleTraces$,
    lengthInPx$: canvasLogicalSize$.map((size) => size?.width),
    measureTextSize$: measureXAxisTextSize$.map(
      (fn) => fn ?? ((s) => s.length * 10),
    ), // FIXME find a better solution,,
    displayUnitPreference$: xAxisDisplayUnitPreference$,
    showZero$: showXAxisZero$,
    commonRange$: commonXRange$,
    doUseCommonRange$: doUseCommonXRange$,
    resetAllRanges,
  });

  const axes = {
    x,
    y: yAxis$({
      axis: "y",
      visibleTraces$,
      lengthInPx$: canvasLogicalSize$.map((size) => size?.height),
      measureTextSize$: measureYAxisTextSize$.map((fn) => fn ?? (() => 10)), // FIXME find a better solution,
      displayUnitPreference$: yAxisDisplayUnitPreference$,
      showZero$: showYAxisZero$,
      autoscale$: autoscaleY$,
      xRange$: x.range$,
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
