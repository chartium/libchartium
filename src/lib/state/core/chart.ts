import {
  Defer,
  WritableSignal,
  type DeferLike,
  type Signal,
} from "@typek/signalhead";
import type { TraceList } from "../../mod.js";
import { xAxis$, yAxis$, type Axis } from "./axis.js";
import { chartCanvas$ } from "./chartCanvas.js";
import { chartRenderer$ } from "./chartRenderer.js";
import type { TextMeasuringFunction } from "./axisTicks.js";
import {
  chartAffineSpace,
  type PointInChartFactory,
  type ValueOnAxisFactory,
} from "./chartAffineSpace.js";
import type { DisplayUnitPreference, ChartRange } from "../../types.js";
import type { ExplicitRangeMargins } from "../../utils/rangeMargins.js";

export interface ChartProps {
  canvas$: Signal<HTMLCanvasElement | undefined>;

  visibleTraces$: Signal<TraceList>;

  measureXAxisTextSize$: Signal<TextMeasuringFunction | undefined>;
  measureYAxisTextSize$: Signal<TextMeasuringFunction | undefined>;

  showXAxisZero$: Signal<boolean>;
  showYAxisZero$: Signal<boolean>;
  margins$: Signal<ExplicitRangeMargins>;
  autoscaleY$: Signal<boolean>;
  commonXRange$: WritableSignal<ChartRange | undefined>;
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
  margins$,
  defer,
}: ChartProps): Chart => {
  return sanitizedChart$({
    canvas$: canvas$.skipEqual(),
    visibleTraces$: visibleTraces$.skipEqual(),
    margins$,
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
  canvas$,
  visibleTraces$,
  measureXAxisTextSize$,
  measureYAxisTextSize$,
  showXAxisZero$,
  showYAxisZero$,
  margins$,
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
    lengthInPx$: canvasLogicalSize$.map((size) => size?.width).skipEqual(),
    measureTextSize$: measureXAxisTextSize$,
    displayUnitPreference$: xAxisDisplayUnitPreference$,
    showZero$: showXAxisZero$,
    margins$,
    commonRange$: commonXRange$,
    doUseCommonRange$: doUseCommonXRange$,
    resetAllRanges,
  });

  const axes = {
    x,
    y: yAxis$({
      axis: "y",
      visibleTraces$,
      lengthInPx$: canvasLogicalSize$.map((size) => size?.height).skipEqual(),
      measureTextSize$: measureYAxisTextSize$,
      displayUnitPreference$: yAxisDisplayUnitPreference$,
      showZero$: showYAxisZero$,
      margins$,
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
    canvasLogicalSize$,
    offscreenCanvas$,

    visibleTraces$,
    xRange$: axes.x.range$,
    yRange$: axes.y.range$,

    defer,
  });

  return { axes, resetAllRanges, point, valueOnAxis };
};
