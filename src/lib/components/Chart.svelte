<script lang="ts">
  import { onDestroy } from "svelte";
  import { chart$ as createChart$ } from "../state/core/chart.js";

  import {
    mut,
    FlockRegistry,
    effect,
    cons,
    WritableSignal,
  } from "@typek/signalhead";
  import { toolKey } from "./toolbar/toolKey.js";
  import { flockReduce } from "../utils/collection.js";
  import { mapOpt } from "../utils/mapOpt.js";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";
  import Guidelines from "./Guidelines.svelte";
  import ActionsOverlay, { oneDZoomWindow } from "./ActionsOverlay.svelte";
  import DefaultToolbar from "./toolbar/DefaultToolbar.svelte";
  import ChartLegend from "./Legend.svelte";
  import TraceTooltip from "./tooltip/TraceTooltip.svelte";
  import { portal } from "svelte-portal";

  import type { TraceList } from "../data/mod.js";
  import {
    asAny,
    type ChartValue,
    type DisplayUnitPreference,
    type ChartRange,
  } from "../types.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";
  import {
    explicifyRangeMargins,
    type RangeMargins,
  } from "../utils/rangeMargins.js";
  import type { TextMeasuringFunction } from "../state/core/axisTicks.js";
  import { type ChartMouseEvent, hover$ } from "../state/interactive/hover.js";
  import type { InterpolationStrategy } from "../../../dist/wasm/libchartium.js";
  import type { ChartStyleSheet } from "../state/core/style.js";
  import { derived } from "@typek/signalhead";
  import RulerBubble from "./RulerBubble.svelte";
  import { setContext } from "../utils/svelte-context.js";

  // SECTION Props
  let klass: string = "";
  export { klass as class };

  let contentSize: [number, number] | undefined; // TODO maybe remove

  let canvas: HTMLCanvasElement | undefined;
  const canvas$ = mut(canvas);
  $: canvas$.set(canvas);

  /** All traces in the chart */
  export let traces: TraceList;
  const traces$ = mut(traces);
  $: traces$.set(traces);

  // TODO change to Flock
  const hiddenTraceIds$ = mut(new Set<string>());
  const visibleTraces$ = traces$
    .map((traces) => traces.withResolvedColors())
    .zip(hiddenTraceIds$)
    .map(([traces, hiddenIds]) => traces.withoutTraces(hiddenIds));

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis. If empty, label will be ommited */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis. If empty, label will be ommited */
  export let yLabel: string = "";

  export let chartStylesheet: Partial<ChartStyleSheet> = {};

  /**
   * Units that should be displayed on the x axis.
   * The "data" option will display the units of the provided data.
   * The "auto" option (default) will choose the best factor according to the range.
   */
  export let defaultXUnit: DisplayUnitPreference = "auto";
  const defaultXUnit$ = mut(defaultXUnit);
  $: defaultXUnit$.set(defaultXUnit);

  /**
   * Units that should be displayed on the y axis.
   * The "data" option will display the units of the provided data.
   * The "auto" option (default) will choose the best factor according to the range.
   */
  export let defaultYUnit: DisplayUnitPreference = "auto";
  const defaultYUnit$ = mut(defaultYUnit);
  $: defaultYUnit$.set(defaultYUnit);

  /** Hides only the units on the label, not the name */
  export let hideXLabelUnits: boolean = false;
  /** Hides only the units on the label, not the name */
  export let hideYLabelUnits: boolean = false;

  /** Hides only the numbers */
  export let hideXTicks: boolean = false;
  /** Hides only the numbers */
  export let hideYTicks: boolean = false;

  /** Hides the lines shown upon mouse hover */
  export let hideXRuler: boolean = false;
  /** Hides the lines shown upon mouse hover */
  export let hideYRuler: boolean = false;
  /** Hides the coordinate bubble by the odge of the graph */
  export let hideXBubble: boolean = false;
  /** Hides the coordinate bubble by the odge of the graph */
  export let hideYBubble: boolean = false;

  /** Hides the tooltips shown next to cursor */
  export let hideTooltip: boolean = false;
  /** Sets the number of traces that are shown in the tooltip by users keyboard */
  export let tooltipTraceCount: number | "all" = 3;
  const tooltipTraceCount$ = mut(tooltipTraceCount);
  $: tooltipTraceCount$.set(tooltipTraceCount);

  /** Hides the highlighted points on traces that the tooltip is showing info about */
  export let hideHoverPoints: boolean = false;

  /** Interpolates the hover points using the provided strategy */
  export let hoverPointsInterpolation: InterpolationStrategy = "linear";

  export let legendPosition: "right" | "bottom" = "right";
  export let hideLegend: boolean = false;
  /** Refers to the little trace sample, simplified just shows color, full shows real width and stroke style */
  export let legendPreviewStyle: "simplified" | "full" = "simplified";
  /** How many traces to show in the legend */
  export let legendTracesShown: number | "all" = "all";

  /** Disables possibility to change X units via context menu on chart axis */
  export let disableXUnitChanges: boolean = false;
  /** Disables possibility to change Y units via context menu on chart axis */
  export let disableYUnitChanges: boolean = false;

  /** Bind this property among several charts to make them all display an x axis ruler when one of them is hovered */
  export let commonXRuler$ = mut<ChartValue>();

  /** Bind this property among several charts to make them all display an y axis ruler when one of them is hovered */
  export let commonYRuler$ = mut<ChartValue>();

  /** Bind this property among several charts to make them all able to share the same X range as you zoom or shift it */
  export let commonXRange$ = mut<ChartRange>();
  /** can be turned off via toolbar */
  export let doUseCommonXRange$ = mut<boolean>(
    commonXRange$.get() !== undefined,
  );

  /** Charts supplied with the same FlockRegistry will have x axis of the same width */
  export let commonXAxisHeight$: FlockRegistry<number> | undefined = undefined;
  $: xAxisHeight = mapOpt(commonXAxisHeight$, (f) =>
    flockReduce(f, (a, b) => Math.max(a, b), 0),
  );

  /** Charts supplied with the same FlockRegistry will have y axis of the same width */
  export let commonYAxisWidth$: FlockRegistry<number> | undefined = undefined;
  $: yAxisWidth = mapOpt(commonYAxisWidth$, (f) =>
    flockReduce(f, (a, b) => Math.max(a, b), 0),
  );

  /** Sets position of the lil infobox that shows number of traces and range */
  export let infoboxPosition:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "none" = "top-right";

  /** Forces autozoom to show x = 0 */
  export let showXAxisZero: boolean = false;
  const showXAxisZero$ = mut(showXAxisZero);
  $: showXAxisZero$.set(showXAxisZero);

  /** Forces autozoom to show y = 0 */
  export let showYAxisZero: boolean = false;
  const showYAxisZero$ = mut(showYAxisZero);
  $: showYAxisZero$.set(showYAxisZero);

  /** Reactively sets such a range for the Y axis such that all the data for current X range are visible (+ margins) */
  export let autoscaleY: boolean = false;
  const autoscaleY$ = mut(autoscaleY);
  $: autoscaleY$.set(autoscaleY);

  /** Disallowes the user to manually change range in the direction of this axis */
  export let disableUserRangeChanges: { x?: boolean; y?: boolean } = {};
  const _disableUserRangeChanges$ = mut(disableUserRangeChanges);
  $: _disableUserRangeChanges$.set(disableUserRangeChanges);
  const disableUserRangeChanges$ = derived(($) => ({
    x: $(_disableUserRangeChanges$).x ?? false,
    y: ($(_disableUserRangeChanges$).y ?? false) || $(autoscaleY$),
  }));

  export let margins: RangeMargins | undefined = undefined;
  const margins$ = mut(margins);
  $: margins$.set(margins);

  /**
   * Whether the chart should be fullscreen
   * to programatically toggle fullscreen, use `fullscreen$.set(true)`
   */
  export let fullscreen$: WritableSignal<boolean> = mut(false);
  fullscreen$.subscribe((f) => {
    if (f) {
      document.addEventListener("keydown", function callback(e) {
        if (e.key === "Escape") {
          fullscreen$.set(false);
          document.removeEventListener("keydown", callback);
        }
      });
    }
  });

  const measureXAxisTextSize$: WritableSignal<
    TextMeasuringFunction | undefined
  > = mut(undefined);

  const measureYAxisTextSize$: WritableSignal<
    TextMeasuringFunction | undefined
  > = mut(undefined);

  const hoverEvent$ = mut<ChartMouseEvent>();

  const chart$ = createChart$({
    canvas$,
    visibleTraces$,
    measureXAxisTextSize$,
    measureYAxisTextSize$,
    showXAxisZero$,
    showYAxisZero$,
    autoscaleY$,
    doUseCommonXRange$,
    commonXRange$,
    margins$: margins$.map((m) => explicifyRangeMargins(m)),
    xAxisDisplayUnitPreference$: defaultXUnit$,
    yAxisDisplayUnitPreference$: defaultYUnit$,
    defer: onDestroy,
  });
  const { nearestTraces$, hoveredTrace$ } = hover$({
    visibleTraces$,
    commonXRuler$,
    commonYRuler$,
    yDataUnit$: chart$.axes.y.dataUnit$,
    tooltipTraceCount$,
    traceHoverPointRadius$: cons(4),
    point: chart$.point,
    defer: onDestroy,
    hoverEvent$,
    interpolation: hoverPointsInterpolation,
  });

  //!SECTION

  const xTicks$ = chart$.axes.x.ticks$;
  const yTicks$ = chart$.axes.y.ticks$;
  const xTicksDecimalPlaces$ = chart$.axes.x.tickDecimalPlaces$;
  const yTicksDecimalPlaces$ = chart$.axes.y.tickDecimalPlaces$;
  const xDisplayUnit$ = chart$.axes.x.currentDisplayUnit$;
  const yDisplayUnit$ = chart$.axes.y.currentDisplayUnit$;

  const visibleAction = mut<VisibleAction | undefined>(undefined);

  /** updates highilghted points in visibleAction */
  effect(($) => {
    const closestTraces = $(nearestTraces$);
    if (!closestTraces) {
      visibleAction.set({ highlightedPoints: [] });
    } else {
      const points = closestTraces.map((trace) => ({
        x: trace.x,
        y: trace.displayY,
        color: trace.style.color,
        radius: trace.style["line-width"],
      }));

      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: points,
      }));
    }
  }).pipe(onDestroy);
  // forbidden rectangle for tooltip to avoid
  let forbiddenRectangle:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined = undefined;

  // and subscribing it to the zoom action
  visibleAction
    .subscribe((action) => {
      if (!canvas) return;
      if (action?.zoom) {
        const canvasRect = canvas.getBoundingClientRect();
        const offsetX = canvasRect.x;
        const offsetY = canvasRect.y;
        forbiddenRectangle = {
          x: action.zoom.x.from * canvas.width + offsetX,
          y: (1 - action.zoom.y.from) * canvas.height + offsetY,
          width: (action.zoom.x.to - action.zoom.x.from) * canvas.width,
          height: (action.zoom.y.to - action.zoom.y.from) * canvas.height,
        };
      } else {
        forbiddenRectangle = undefined;
      }
    })
    .pipe(onDestroy);

  const notifyOfAutozoom$ = derived(($) => {
    if (!$(autoscaleY$)) return false;

    const shift = $(visibleAction)?.shift;
    if (shift?.dy !== undefined && shift.dy !== 0) return true;

    const zoom = $(visibleAction)?.zoom;
    if (zoom === undefined) return false;

    const isZoominY =
      Math.abs(zoom.y.from - zoom.y.to) >
      chart$.valueOnAxis("y").fromLogicalPixels(oneDZoomWindow).toFraction();

    return isZoominY;
  }).skipEqual();

  let parentDiv: HTMLDivElement;
  let wrapDiv: HTMLDivElement;

  setContext(toolKey, {
    notifyOfAutozoom$,
    autoscaleY$,
    doUseCommonXRange$,
    fullscreen$,
    getWrapDiv: () => {
      return wrapDiv;
    },
    toggleLegend: () => {
      hideLegend = !hideLegend;
    },
    getTraceList: () => traces,
    getTitle: () => title,
  });
</script>

{#if !hideTooltip && $commonXRuler$ !== undefined}
  <TraceTooltip
    {forbiddenRectangle}
    {chartStylesheet}
    hoverX={$commonXRuler$}
    nearestTraces={$nearestTraces$}
    hoveredTrace={$hoveredTrace$}
    previewStyle={legendPreviewStyle}
    decimalPlaces={$yTicksDecimalPlaces$ + 1}
    xDisplayUnit={$xDisplayUnit$}
    yDisplayUnit={$yDisplayUnit$}
  />
{/if}
<div bind:this={parentDiv} style="height: 100%; width: 100%">
  <div
    bind:this={wrapDiv}
    use:portal={$fullscreen$ ? "body" : parentDiv}
    class:fullscreen={$fullscreen$}
    class={klass}
    style={"height: 100%; width: 100%"}
  >
    <ChartGrid
      bind:contentSize
      xAxisHeight={$xAxisHeight}
      yAxisWidth={$yAxisWidth}
    >
      <svelte:fragment slot="title">
        {title}
      </svelte:fragment>
      <svelte:fragment slot="subtitle">
        {subtitle}
      </svelte:fragment>

      <AxisTicks
        slot="yticks"
        axis="y"
        {chartStylesheet}
        ticks={$yTicks$ ?? []}
        label={yLabel}
        unit={$yDisplayUnit$}
        hideLabelUnits={hideYLabelUnits}
        {visibleAction}
        disableInteractivity={disableUserRangeChanges$.map((d) => d.y)}
        disableUnitChange={disableYUnitChanges}
        hideTicks={hideYTicks}
        on:shift={(d) => chart$.axes.y.shiftRange(d.detail.dy ?? 0)}
        on:reset={() => chart$.axes.y.resetRange()}
        unitChangeActions={chart$.axes.y.unitChangeActions$}
        bind:textLength={$measureYAxisTextSize$}
        dimensionFlock={commonYAxisWidth$}
      />
      {#if !hideYBubble && $commonXRuler$ !== undefined && $commonYRuler$ !== undefined}
        <div class="y bubble-reference">
          <RulerBubble
            autoDecimalPlaces={$yTicksDecimalPlaces$ + 1}
            axis="y"
            position={{
              x: 0,
              y: chart$
                .valueOnAxis("y")
                .fromQuantity($commonYRuler$)
                .toLogicalPixels(),
            }}
            value={$commonYRuler$}
            displayUnit={$yDisplayUnit$}
          />
        </div>
      {/if}
      {#if !hideXBubble && $commonXRuler$ !== undefined}
        <div class="x bubble-reference">
          <RulerBubble
            autoDecimalPlaces={$yTicksDecimalPlaces$ + 1}
            {chartStylesheet}
            axis="x"
            position={{
              y: 0,
              x: chart$
                .valueOnAxis("x")
                .fromQuantity($commonXRuler$)
                .toLogicalPixels(),
            }}
            value={$commonXRuler$}
            displayUnit={$xDisplayUnit$}
          />
        </div>
      {/if}

      <AxisTicks
        slot="xticks"
        axis="x"
        {chartStylesheet}
        ticks={$xTicks$ ?? []}
        label={xLabel}
        unit={$xDisplayUnit$}
        hideLabelUnits={hideXLabelUnits}
        {visibleAction}
        disableInteractivity={disableUserRangeChanges$.map((d) => d.y)}
        disableUnitChange={disableXUnitChanges}
        hideTicks={hideXTicks}
        on:shift={(d) => chart$.axes.x.shiftRange(d.detail.dx ?? 0)}
        on:reset={() => chart$.axes.x.resetRange()}
        unitChangeActions={chart$.axes.x.unitChangeActions$}
        bind:textLength={$measureXAxisTextSize$}
        dimensionFlock={commonXAxisHeight$}
      />

      <Guidelines
        xTicks={$xTicks$}
        yTicks={$yTicks$}
        chartStylesheet={chartStylesheet ?? {}}
      />

      <canvas bind:this={canvas} on:contextmenu|preventDefault />

      {#if $$slots.infobox && infoboxPosition !== "none"}
        <div
          class="infobox"
          style="{infoboxPosition.includes('top') ? 'top' : 'bottom'} : 0.5rem;
      {infoboxPosition.includes('left') ? 'left' : 'right'} : 0.5rem; "
        >
          <slot name="infobox" />
        </div>
      {/if}

      <ActionsOverlay
        chart={chart$}
        {visibleAction}
        {hideHoverPoints}
        {hideXRuler}
        {hideYRuler}
        disableUserRangeChanges$={derived(($) => ({
          x: $(disableUserRangeChanges$).x,
          y: $(disableUserRangeChanges$).y,
        }))}
        traceHovered={$hoveredTrace$ !== undefined}
        commonXRuler={commonXRuler$}
        commonYRuler={commonYRuler$}
        on:reset={() => chart$.resetAllRanges()}
        on:zoom={(d) => {
          chart$.axes.x.zoomRange(d.detail.x);
          chart$.axes.y.zoomRange(d.detail.y);
        }}
        on:shift={(d) => {
          if (
            d.detail.dx &&
            d.detail.dx !== 0 &&
            !disableUserRangeChanges$.get().x
          )
            chart$.axes.x.shiftRange(d.detail.dx);
          if (
            d.detail.dy &&
            d.detail.dy !== 0 &&
            !disableUserRangeChanges$.get().y
          )
            chart$.axes.y.shiftRange(d.detail.dy);
        }}
        on:mousemove={(e) => hoverEvent$.set({ name: "move", event: asAny(e) })}
        on:mouseout={() => hoverEvent$.set({ name: "out" })}
        on:blur={() => hoverEvent$.set({ name: "out" })}
      />

      <div class="toolbar" slot="overlay">
        <slot name="toolbar">
          <DefaultToolbar />
        </slot>
      </div>

      <svelte:fragment slot="right-legend">
        {#if legendPosition === "right" && !hideLegend}
          <ChartLegend
            {traces}
            {chartStylesheet}
            hiddenTraceIds={hiddenTraceIds$}
            previewStyle={legendPreviewStyle}
            numberOfShownTraces={legendTracesShown === "all"
              ? traces.traceCount
              : legendTracesShown}
          />
        {/if}
      </svelte:fragment>
      <svelte:fragment slot="bottom-legend">
        {#if legendPosition === "bottom" && !hideLegend}
          <ChartLegend
            {traces}
            {chartStylesheet}
            hiddenTraceIds={hiddenTraceIds$}
            previewStyle={legendPreviewStyle}
            numberOfShownTraces={legendTracesShown === "all"
              ? traces.traceCount
              : legendTracesShown}
          />
        {/if}
      </svelte:fragment>
    </ChartGrid>
  </div>
</div>

<style lang="scss">
  :global(:root) {
    --libchartium-secondary-background: rgb(51, 51, 51);
    --libchartium-highlight-background: rgb(75, 75, 75);
  }
  .fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .infobox {
    position: absolute;
    user-select: none;

    text-align: left;
    padding: 0.5rem;

    font-size: 0.8em;
    max-width: 300px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    background: hsla(0, 0%, 5%, 0.6);
  }

  .toolbar {
    position: absolute;
    right: 0;
    top: 0;

    display: flex;
    flex-flow: row nowrap;
    align-items: center;

    opacity: 0.6;
    transition: all 0.2s ease-in-out;

    &:hover {
      opacity: 0.9;
      background-color: hsla(0, 0%, 5%, 0.6);
    }
  }

  .bubble-reference {
    &.x {
      bottom: 0;
    }
    &.y {
      top: 0;
    }
    left: 0;
    position: absolute;
    height: 0;
    width: 0;
    overflow: visible;
    user-select: none;
    pointer-events: none;
  }
</style>
