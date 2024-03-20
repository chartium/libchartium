<script lang="ts">
  import type { ChartiumController } from "../data-worker/index.js";
  import { type Quantity, type ChartValue } from "../types.js";
  import type { TraceList } from "../data-worker/trace-list.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";

  import { onDestroy } from "svelte";
  import { chart$ as createChart$ } from "../chart/chart.js";

  import { mut, FlockRegistry } from "@mod.js/signals";
  import type { RangeMargins } from "../utils/rangeMargins.js";
  import { setContext } from "svelte-typed-context";
  import { toolKey } from "./toolbar/toolKey.js";
  import { flockReduce } from "../utils/collection.js";
  import { mapOpt } from "../utils/mapOpt.js";
  import type { DisplayUnitPreference } from "../chart/axis.js";
  import type { TextMeasuringFunction } from "../chart/axisTicks.js";
  import type { Qdn } from "../chart/chartAffineSpace.js";

  // SECTION Props
  let klass: string = "";
  export { klass as class };

  let contentSize: [number, number] | undefined; // TODO maybe remove

  export let controller: ChartiumController;
  const controller$ = mut(controller);
  $: controller$.set(controller);

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
    .zip(hiddenTraceIds$)
    .map(([traces, hiddenIds]) => traces.withoutTraces(hiddenIds));

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis. If empty, label will be ommited */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis. If empty, label will be ommited */
  export let yLabel: string = "";

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

  /** Hides the thick line at the edge of the graph */
  export let hideXAxisLine: boolean = false;
  /** Hides the thick line at the edge of the graph */
  export let hideYAxisLine: boolean = false;

  /** Hides only the units on the label, not the name */
  export let hideXLabelUnits: boolean = false;
  /** Hides only the units on the label, not the name */
  export let hideYLabelUnits: boolean = false;

  /** Hides only the numbers */
  export let hideXTicks: boolean = false;
  /** Hides only the numbers */
  export let hideYTicks: boolean = false;

  /** Hides the background graph lines */
  export let hideXGuidelines: boolean = false;
  /** Hides the background graph lines */
  export let hideYGruidelines: boolean = false;

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
  export let tooltipTracesShown: number | "all" = 3;
  /** Hides the highlighted points on traces that the tooltip is showing info about */
  export let hideHoverPoints: boolean = false;

  export let legendPosition: "right" | "bottom" = "right";
  export let hideLegend: boolean = false;
  /** Refers to the little trace sample, simplified just shows color, full shows real width and stroke style */
  export let legendPreviewStyle: "simplified" | "full" = "simplified";
  /** How many traces to show in the legend */
  export let legendTracesShown: number | "all" = "all";

  /** Disables zooming and moving */ // TODO should this include context menu?
  export let disableInteractivity: boolean = false;

  /** Disables possibility to change X units via context menu on chart axis */
  export let disableXUnitChanges: boolean = false;
  /** Disables possibility to change Y units via context menu on chart axis */
  export let disableYUnitChanges: boolean = false;

  /** Bind this property among several charts to make them all display an x axis ruler when one of them is hovered */
  export let commonXRuler$ = mut<ChartValue>();

  /** Bind this property among several charts to make them all display an y axis ruler when one of them is hovered */
  export let commonYRuler$ = mut<ChartValue>();

  /** Charts supplied with the same FlockRegistry will have x axis of the same width */
  export let commonXAxisHeight: FlockRegistry<number> | undefined = undefined;
  $: xAxisHeight = mapOpt(commonXAxisHeight, (f) =>
    flockReduce(f, (a, b) => Math.max(a, b), 0),
  );

  /** Charts supplied with the same FlockRegistry will have y axis of the same width */
  export let commonYAxisWidth: FlockRegistry<number> | undefined = undefined;
  $: yAxisWidth = mapOpt(commonYAxisWidth, (f) =>
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

  export let margins: RangeMargins | undefined = undefined;
  const margins$ = mut(margins);
  $: margins$.set(margins);

  let measureXAxisTextSize: TextMeasuringFunction | undefined;
  const measureXAxisTextSize$ = mut(measureXAxisTextSize);
  $: measureXAxisTextSize$.set(measureXAxisTextSize);

  let measureYAxisTextSize: TextMeasuringFunction | undefined;
  const measureYAxisTextSize$ = mut(measureYAxisTextSize);
  $: measureYAxisTextSize$.set(measureYAxisTextSize);

  const chart$ = createChart$({
    controller$,
    canvas$,
    visibleTraces$,
    measureXAxisTextSize$,
    measureYAxisTextSize$,
    showXAxisZero$,
    showYAxisZero$,
    xAxisDisplayUnitPreference$: defaultXUnit$,
    yAxisDisplayUnitPreference$: defaultYUnit$,
    defer: onDestroy,
  });

  $: console.log("controller:", $controller$);
  $: console.log("canvas:", $canvas$);
  $: console.log("visible traces:", $visibleTraces$);
  $: console.log("measureXAxis:", $measureXAxisTextSize$);
  $: console.log("measureYAxis:", $measureYAxisTextSize$);
  $: console.log("show x axis zero:", $showXAxisZero$);
  $: console.log("show y axis zero:", $showYAxisZero$);
  $: console.log("x axis display unit preference:", $defaultXUnit$);
  $: console.log("y axis display unit preference:", $defaultYUnit$);

  //!SECTION

  const xTicks$ = chart$.axes.x.ticks$;
  const yTicks$ = chart$.axes.y.ticks$;
  const xDisplayUnit$ = chart$.axes.x.currentDisplayUnit$;
  const yDisplayUnit$ = chart$.axes.y.currentDisplayUnit$;

  // const QND_FORMAT_OPTIONS: QndFormatOptions = {
  //   dateFormat: "MMM DD, hh:mm:ss",
  // };
  // const xFormatOptions$ = xDisplayUnit$.map((unit) => ({
  //   ...QND_FORMAT_OPTIONS,
  //   unit,
  // }));
  // const yFormatOptions$ = yDisplayUnit$.map((unit) => ({
  //   ...QND_FORMAT_OPTIONS,
  //   unit,
  // }));

  // const visibleAction = mut<VisibleAction | undefined>(undefined);

  // let showTooltip: boolean = false;
  // const hoverXQuantity$ = mut<Qdn>();
  // const hoverYQuantity$ = mut<Qdn>();

  // const updateHoverQuantities = (e: MouseEvent) => {
  //   const { x, y } = chart$
  //     .point()
  //     .fromLogicalPixels(e.offsetX, e.offsetY)
  //     .toQuantitites();

  //   hoverXQuantity$.set(x);
  //   hoverYQuantity$.set(y);
  //   commonXRuler$.set(x);
  //   commonYRuler$.set(y);
  // };

  // const closestTraces$ = derived(($) => {
  //   const x = $(hoverXQuantity$);
  //   const y = $(hoverYQuantity$);
  //   if (x === undefined || y === undefined) return;

  //   const showCount =
  //     tooltipTracesShown === "all"
  //       ? $(visibleTraces$).traceCount
  //       : tooltipTracesShown;

  //   return $(visibleTraces$).findClosestTracesToPoint({ x, y }, showCount);
  // });

  // const tracesInfo$ = derived(
  //   ($) =>
  //     $(closestTraces$)?.map(({ traceInfo, closestPoint: { x, y } }) => ({
  //       styledTrace: traceInfo,
  //       x: qndFormat(x, $(xFormatOptions$)),
  //       y: qndFormat(y, $(yFormatOptions$)),
  //     })) ?? [],
  // );

  /** updates highilghted points in visibleAction */
  // effect(($) => {
  //   const closestTraces = $(closestTraces$);
  //   if (!closestTraces) {
  //     visibleAction.set({ highlightedPoints: [] });
  //   } else {
  //     const points = closestTraces.map((trace) => ({
  //       x: trace.closestPoint.x,
  //       y: trace.closestPoint.y,
  //       color: trace.traceInfo.color,
  //       radius: trace.traceInfo.width,
  //     }));

  //     visibleAction.update((action) => ({
  //       ...action,
  //       highlightedPoints: points,
  //     }));
  //   }
  // }).pipe(onDestroy);

  // $: if (chart$) {
  //   // ideally this would just update but without mousemove we don't know where the mouse is
  //   chart$.range.x.subscribe(() => updateHighlightPoints(chart$, []));
  //   chart$.range.y.subscribe(() => updateHighlightPoints(chart$, []));
  // }

  /** How close to a trace is considered close enough to get only one trace info */
  // const closenessDistance = 5;

  // const traceCloseEnough$ = derived(($) => {
  //   const trace = $(closestTraces$)?.[0];
  //   if (!trace) return false;

  //   const [x, y] = [$(hoverXQuantity$), $(hoverYQuantity$)];
  //   if (x === undefined || y === undefined) return false;

  //   const hoverPoint = chart$.point().fromQuantities(x, y);
  //   const closestPoint = chart$
  //     .point()
  //     .fromQuantities(trace.closestPoint.x, trace.closestPoint.y);

  //   return (
  //     hoverPoint.vectorTo(closestPoint).magnitudeInLogicalPixels() <
  //     closenessDistance
  //   );
  // });

  // look for the closest trace to the mouse and if it's close enough, show more info
  // const selectedTrace$ = derived(($) => {
  //   if (!$(traceCloseEnough$)) return;

  //   const { from, to } = $(chart$.axes.x.range$);
  //   const trace = $(closestTraces$)?.[0];
  //   if (!trace) return;

  //   const {
  //     traceInfo,
  //     closestPoint: { x, y },
  //   } = trace;

  //   const { min, max, avg } = $(visibleTraces$).calculateStatistics({
  //     traces: [trace.traceInfo.id],
  //     from,
  //     to,
  //   })[0];

  //   return {
  //     styledTrace: traceInfo,
  //     x: qndFormat(x, $(xFormatOptions$)),
  //     y: qndFormat(y, $(yFormatOptions$)),
  //     min: qndFormat(min, $(yFormatOptions$)),
  //     max: qndFormat(max, $(yFormatOptions$)),
  //     avg: qndFormat(avg, $(yFormatOptions$)),
  //   };
  // });

  // forbidden rectangle for tooltip to avoid
  // let forbiddenRectangle:
  //   | {
  //       x: number;
  //       y: number;
  //       width: number;
  //       height: number;
  //     }
  //   | undefined = undefined;

  // and subscribing it to the zoom action
  // visibleAction
  //   .subscribe((action) => {
  //     if (!canvas) return;
  //     if (action?.zoom) {
  //       const canvasRect = canvas.getBoundingClientRect();
  //       const offsetX = canvasRect.x;
  //       const offsetY = canvasRect.y;
  //       forbiddenRectangle = {
  //         x: action.zoom.x.from * canvas.width + offsetX,
  //         y: (1 - action.zoom.y.from) * canvas.height + offsetY,
  //         width: (action.zoom.x.to - action.zoom.x.from) * canvas.width,
  //         height: (action.zoom.y.to - action.zoom.y.from) * canvas.height,
  //       };
  //     } else {
  //       forbiddenRectangle = undefined;
  //     }
  //   })
  //   .pipe(onDestroy);

  /** In fractions of graph height */
  // let persistentYThresholds: (Quantity | number | Dayjs)[] = [];
  // $: presYThreshFracs = persistentYThresholds.map((q) =>
  //   chart$.valueOnAxis("y").fromQuantity(q).toFraction(),
  // );
  // // TODO make ValueOnAxis properly reactive
  // chart$.axes.y.range$.subscribe(() => {
  //   presYThreshFracs = persistentYThresholds.map((q) =>
  //     chart$.valueOnAxis("y").fromQuantity(q).toFraction(),
  //   );
  // });

  let parentDiv: HTMLDivElement;
  let wrapDiv: HTMLDivElement;
  export function getWrapDiv(): HTMLDivElement {
    return wrapDiv;
  }
  setContext(toolKey, {
    getWrapDiv,
    toggleLegend: () => {
      hideLegend = !hideLegend;
    },
    getTracelist: () => traces,
    getTitle: () => title,
    toggleFullscreen: () => {
      fullscreen = !fullscreen;
      if (fullscreen) {
        document.addEventListener("keydown", function callback(e) {
          if (e.key === "Escape") {
            fullscreen = false;
            document.removeEventListener("keydown", callback);
          }
        });
      }
    },
  });

  // FIXME DEBUG
  let addPersistentThreshold: () => void;
  let filterByThreshold: () => void;
  // $: (window as any).addPersistentThreshold = addPersistentThreshold;
  // $: (window as any).filterByThreshold = filterByThreshold;
  let fullscreen = false;
</script>

<canvas bind:this={canvas} on:contextmenu|preventDefault />

<!--
{#if !hideTooltip}
  <Tooltip
    {forbiddenRectangle}
    nearestTracesInfo={$tracesInfo$}
    singleTraceInfo={$selectedTrace$}
    show={showTooltip}
    previewStyle={legendPreviewStyle}
  />
{/if}
<div bind:this={parentDiv} style="height: 100%; width: 100%">
  <div
    bind:this={wrapDiv}
    use:portal={fullscreen ? "body" : parentDiv}
    class:fullscreen
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
        ticks={$yTicks$ ?? []}
        label={yLabel}
        unit={$yDisplayUnit$}
        hideLabelUnits={hideYLabelUnits}
        {visibleAction}
        {disableInteractivity}
        disableUnitChange={disableYUnitChanges}
        hideTicks={hideYTicks}
        on:shift={(d) => chart$.axes.y.shiftRange(d.detail.dy ?? 0)}
        on:reset={() => chart$.axes.y.resetRange()}
        raiseFactor={chart$.axes.y.unitChangeActions$.map(({ raise }) => raise)}
        lowerFactor={chart$.axes.y.unitChangeActions$.map(({ lower }) => lower)}
        resetUnit={chart$.axes.y.unitChangeActions$.map(({ reset }) => reset)}
        bind:textLength={measureYAxisTextSize}
        dimensionFlock={commonYAxisWidth}
      />

      <AxisTicks
        slot="xticks"
        axis="x"
        ticks={$xTicks$ ?? []}
        label={xLabel}
        unit={$xDisplayUnit$}
        hideLabelUnits={hideXLabelUnits}
        {visibleAction}
        {disableInteractivity}
        disableUnitChange={disableXUnitChanges}
        hideTicks={hideXTicks}
        on:shift={(d) => chart$.axes.x.shiftRange(d.detail.dx ?? 0)}
        on:reset={() => chart$.axes.x.resetRange()}
        raiseFactor={chart$.axes.x.unitChangeActions$.map(({ raise }) => raise)}
        lowerFactor={chart$.axes.x.unitChangeActions$.map(({ lower }) => lower)}
        resetUnit={chart$.axes.x.unitChangeActions$.map(({ reset }) => reset)}
        bind:textLength={measureXAxisTextSize}
        dimensionFlock={commonXAxisHeight}
      />

      <Guidelines
        xTicks={hideXGuidelines ? [] : $xTicks$ ?? []}
        yTicks={hideYGruidelines ? [] : $yTicks$ ?? []}
        renderXAxis={!hideXAxisLine}
        renderYAxis={!hideYAxisLine}
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
        {hideXBubble}
        {hideYBubble}
        hoverXQuantity={$hoverXQuantity$ ?? 0}
        hoverYQuantity={$hoverYQuantity$ ?? 0}
        {disableInteractivity}
        presYThreshFracs={[]}
        commonXRuler={commonXRuler$}
        commonYRuler={commonYRuler$}
        bind:filterByThreshold
        bind:addPersistentThreshold
        traceHovered={$selectedTrace$ !== undefined}
        on:reset={() => chart$.resetAllRanges()}
        on:zoom={(d) => {
          chart$.axes.x.zoomRange(d.detail.x);
          chart$.axes.y.zoomRange(d.detail.y);
        }}
        on:shift={(d) => {
          chart$.axes.x.shiftRange(d.detail.dx ?? 0);
          chart$.axes.y.shiftRange(d.detail.dy ?? 0);
        }}
        on:yThreshold={(t) => {
          /*
          if (t.detail.type === "persistent") {
            const thresholdQ = chart$
              .valueOnAxis("y")
              .fromFraction(1 - t.detail.thresholdFrac)
              .toQuantity();
            if (thresholdQ) persistentYThresholds.push(thresholdQ);
            persistentYThresholds = persistentYThresholds;
          }
          if (t.detail.type === "filtering")
            hiddenTraceIds$.update((curr) => {
              // for (const id of chart$?.idsUnderThreshold(t) ?? []) curr.add(id);
              return curr;
            });
          */
        }}
        on:mousemove={(e) => {
          showTooltip = true;
          updateHoverQuantities(e);
        }}
        on:mouseout={() => {
          showTooltip = false;
          // closestTraces$.set([]);
          visibleAction.update((action) => ({
            ...action,
            highlightedPoints: [],
          }));
          commonXRuler$.set(undefined);
          commonYRuler$.set(undefined);
        }}
        on:blur={() => {
          showTooltip = false;
        }}
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
-->
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
    padding: 0.25rem;

    font-size: 0.8em;
    max-width: 300px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    background: rgba(58, 3, 3, 0.6);
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
      background-color: rgba(58, 3, 3, 0.6);
    }
  }
</style>
