<script lang="ts">
  import type { ChartiumController } from "../data-worker/index.js";
  import {
    type Quantity,
    type Unit,
    type ChartValuePoint,
    type ChartValue,
    X,
    type ExportRow as ExportRow,
  } from "../types.js";
  import type { TraceInfo, TraceList } from "../data-worker/trace-list.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";

  import { onDestroy } from "svelte";
  import { Chart } from "./chart.js";

  import ActionsOverlay from "./ActionsOverlay.svelte";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";
  import ChartLegend from "./Legend.svelte";
  import Guidelines from "./Guidelines.svelte";
  import Tooltip from "./TraceTooltip.svelte";
  import { mut, cons, FlockRegistry } from "@mod.js/signals";
  import type { Remote } from "comlink";
  import { qndFormat, type QndFormatOptions } from "../utils/format.js";
  import type { Dayjs } from "dayjs";
  import type { RangeMargins } from "../utils/rangeMargins.js";
  import DefaultToolbar from "./Toolbar/DefaultToolbar.svelte";
  import { setContext } from "svelte-typed-context";
  import { toolKey } from "./Toolbar/toolKey.js";
  import { flockReduce } from "../utils/collection.js";
  import { portal } from "svelte-portal";

  // SECTION Props

  export let controller: ChartiumController | Remote<ChartiumController>;
  let chart: Chart | undefined = undefined;
  let canvas: HTMLCanvasElement;

  if (controller.initialized !== true) {
    console.warn(
      "Trying to create a Chart while the ChartiumController is still not initialized.",
    );
    controller.initialized.then(() => chartCanvasChanged(offscreenCanvas));
  }

  /** All traces in the chart */
  export let traces: TraceList;
  let hiddenTraceIds = mut(new Set<string>());
  $: visibleTraces = traces.withoutTraces($hiddenTraceIds);
  $: chart?.traces.set(visibleTraces);

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
  export let defaultXUnit: Unit | undefined | "auto" | "data" = "auto";

  /**
   * Units that should be displayed on the y axis.
   * The "data" option will display the units of the provided data.
   * The "auto" option (default) will choose the best factor according to the range.
   */
  export let defaultYUnit: Unit | "auto" | "data" = "auto";

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
  export let commonXRuler = mut<ChartValue>();

  /** Bind this property among several charts to make them all display an y axis ruler when one of them is hovered */
  export let commonYRuler = mut<ChartValue>();

  /** Charts supplied with the same FlockRegistry will have x axis of the same width */
  export let commonXAxisHeight: FlockRegistry<number> | undefined = undefined;
  $: xAxisHeight = flockReduce(commonXAxisHeight, Math.max);

  /** Charts supplied with the same FlockRegistry will have y axis of the same width */
  export let commonYAxisWidth: FlockRegistry<number> | undefined = undefined;
  $: yAxisWidth = flockReduce(commonYAxisWidth, Math.max);

  /** Sets position of the lil infobox that shows number of traces and range */
  export let infoboxPosition:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "none" = "top-right";

  /** Forces autozoom to show x = 0 */
  export let showXAxisZero: boolean = false;
  $: chart?.showXAxisZero.set(showXAxisZero);

  /** Forces autozoom to show y = 0 */
  export let showYAxisZero: boolean = false;
  $: chart?.showYAxisZero.set(showYAxisZero);

  export let margins: RangeMargins | undefined = undefined;
  $: chart?.margins.set(margins);

  //!SECTION

  $: offscreenCanvas = canvas ? canvas.transferControlToOffscreen() : undefined;
  $: chartCanvasChanged(offscreenCanvas);
  function chartCanvasChanged(offscreenCanvas: OffscreenCanvas | undefined) {
    if (controller.initialized !== true) return (chart = undefined);
    if (!offscreenCanvas) return (chart = undefined);
    chart = new Chart(controller, offscreenCanvas, visibleTraces);
  }

  $: xTicks = chart?.ticks.x;
  $: yTicks = chart?.ticks.y;

  $: chart?.defaultDisplayUnit.x.set(defaultXUnit);
  $: chart?.defaultDisplayUnit.y.set(defaultYUnit);
  $: xDisplayUnit = chart?.currentDisplayUnit.x;
  $: yDisplayUnit = chart?.currentDisplayUnit.y;
  let xAxisTextSize: ((text: string) => number) | undefined;
  let yAxisTextSize: ((text: string) => number) | undefined;

  const QND_FORMAT_OPTIONS: QndFormatOptions = {
    dateFormat: "MMM DD, hh:mm:ss",
  };
  $: xFormatOptions = {
    ...QND_FORMAT_OPTIONS,
    unit: $xDisplayUnit,
  };
  $: yFormatOptions = {
    ...QND_FORMAT_OPTIONS,
    unit: $yDisplayUnit,
  };

  // walkaround for svelte 4 random reactivity bug
  $: chartUpdated(chart);
  function chartUpdated(chart: Chart | undefined) {
    if (!chart) return;
    chart.textSize.x = xAxisTextSize;
    chart.textSize.y = yAxisTextSize;
  }

  const visibleAction = mut<VisibleAction | undefined>(undefined);

  let contentSize: [number, number] = [1, 1];
  $: if (chart) {
    chart.size.set({
      width: contentSize[0] * devicePixelRatio,
      height: contentSize[1] * devicePixelRatio,
    });
  }

  let showTooltip: boolean = false;
  let hoverXQuantity: ChartValue;
  let hoverYQuantity: ChartValue;

  const updateHoverQuantities = (e: MouseEvent) => {
    if (!chart) return;
    const zoom = devicePixelRatio;
    hoverXQuantity = chart.coordinatesToQuantities(e.offsetX * zoom, "x");
    hoverYQuantity = chart.coordinatesToQuantities(e.offsetY * zoom, "y");
    commonXRuler.set(hoverXQuantity);
    commonYRuler.set(hoverYQuantity);
  };

  $: closestTraces =
    chart && hoverXQuantity && hoverYQuantity
      ? visibleTraces.findClosestTracesToPoint(
          {
            x: hoverXQuantity,
            y: hoverYQuantity,
          },
          tooltipTracesShown === "all"
            ? visibleTraces.traceCount
            : tooltipTracesShown,
        )
      : undefined;
  $: tracesInfo =
    closestTraces?.map((trace) => ({
      styledTrace: trace.traceInfo,
      x: qndFormat(trace.closestPoint.x, xFormatOptions),
      y: qndFormat(trace.closestPoint.y, yFormatOptions),
    })) ?? [];

  /** updates highilghted points in visibleAction */
  function updateHighlightPoints(
    chart: Chart | undefined,
    closestTraces:
      | {
          traceInfo: TraceInfo;
          closestPoint: ChartValuePoint;
        }[]
      | undefined,
  ) {
    if (closestTraces === undefined || chart === undefined) {
      visibleAction.set({ highlightedPoints: [] });
    } else {
      const points = closestTraces.map((trace) => ({
        x: trace.closestPoint.x,
        y: trace.closestPoint.y,
        color: trace.traceInfo.color,
        radius: trace.traceInfo.width,
      }));

      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: points,
      }));
    }
  }
  $: updateHighlightPoints(chart, closestTraces);

  $: if (chart) {
    // ideally this would just update but without mousemove we don't know where the mouse is
    chart.range.x.subscribe(() => updateHighlightPoints(chart, []));
    chart.range.y.subscribe(() => updateHighlightPoints(chart, []));
  }

  /** How close to a trace is considered close enough to get only one trace info */
  const closenessDistance = 5;
  let selectedTrace:
    | {
        styledTrace: TraceInfo;
        x: string;
        y: string;
        min: string;
        max: string;
        avg: string;
      }
    | undefined = undefined;

  let traceCloseEnough: boolean;

  $: if (chart && closestTraces && closestTraces?.length !== 0) {
    // FIXME rethink this, this is ew
    traceCloseEnough =
      chart.distanceInPx(closestTraces[0].closestPoint, {
        x: hoverXQuantity,
        y: hoverYQuantity,
      }) < closenessDistance;
  }

  // look for the closest trace to the mouse and if it's close enough, show more info
  $: if (
    chart &&
    closestTraces !== undefined &&
    closestTraces?.length !== 0 &&
    traceCloseEnough
  ) {
    const { from, to } = chart.range.x.get();
    const statsOfClosest = visibleTraces.calculateStatistics({
      traces: [closestTraces[0].traceInfo.id],
      from,
      to,
    })[0];

    selectedTrace = {
      styledTrace: closestTraces[0].traceInfo,
      x: qndFormat(closestTraces[0].closestPoint.x, xFormatOptions),
      y: qndFormat(closestTraces[0].closestPoint.y, yFormatOptions),
      min: qndFormat(statsOfClosest.min, yFormatOptions),
      max: qndFormat(statsOfClosest.max, yFormatOptions),
      avg: qndFormat(statsOfClosest.avg, yFormatOptions),
    };
  } else {
    selectedTrace = undefined;
  }

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
  onDestroy(
    visibleAction.subscribe((action) => {
      if (!chart) return;
      if (action?.zoom) {
        const canvasRect = canvas.getBoundingClientRect();
        const offsetX = canvasRect.x;
        const offsetY = canvasRect.y;
        forbiddenRectangle = {
          x: action.zoom.x.from * chart.canvas!.width + offsetX,
          y: (1 - action.zoom.y.from) * chart.canvas!.height + offsetY,
          width: (action.zoom.x.to - action.zoom.x.from) * chart.canvas!.width,
          height:
            (action.zoom.y.to - action.zoom.y.from) * chart.canvas!.height,
        };
      } else {
        forbiddenRectangle = undefined;
      }
    }),
  );

  /** In fractions of graph height */
  let persistentYThresholds: (Quantity | number | Dayjs)[] = [];
  $: presYThreshFracs = persistentYThresholds.map(
    (q) => chart?.quantitiesToFractions(q, "y") ?? 0,
  );
  $: chart?.range.y.subscribe(() => {
    presYThreshFracs = persistentYThresholds.map(
      (q) => chart?.quantitiesToFractions(q, "y") ?? 0,
    );
  });

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
    },
  });

  // FIXME DEBUG
  let addPersistentThreshold: () => void;
  let filterByThreshold: () => void;
  $: (window as any).addPersistentThreshold = addPersistentThreshold;
  $: (window as any).filterByThreshold = filterByThreshold;
  let fullscreen = false;
</script>

{#if !hideTooltip}
  <Tooltip
    {forbiddenRectangle}
    nearestTracesInfo={tracesInfo}
    singleTraceInfo={selectedTrace}
    show={showTooltip}
    previewStyle={legendPreviewStyle}
  />
{/if}
<div
  bind:this={wrapDiv}
  style="height: 100%; width: 100%; background-color: var(--background-color)"
>
  <div
    use:portal={fullscreen ? "body" : wrapDiv}
    class:fullscreen
    style={"height: 100%; width: 100%;"}
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
        ticks={$yTicks ?? []}
        label={yLabel}
        unit={$yDisplayUnit}
        hideLabelUnits={hideYLabelUnits}
        {visibleAction}
        {disableInteractivity}
        disableUnitChange={disableYUnitChanges}
        hideTicks={hideYTicks}
        on:shift={(d) => chart?.shiftRange(d)}
        on:reset={() => chart?.resetZoom("y")}
        raiseFactor={chart?.raiseYFactorAction ?? cons(undefined)}
        lowerFactor={chart?.lowerYFactorAction ?? cons(undefined)}
        resetUnit={chart?.resetYFactorAction ?? cons(undefined)}
        bind:textLength={yAxisTextSize}
        dimensionFlock={commonYAxisWidth}
      />

      <AxisTicks
        slot="xticks"
        axis="x"
        ticks={$xTicks ?? []}
        label={xLabel}
        unit={$xDisplayUnit}
        hideLabelUnits={hideXLabelUnits}
        {visibleAction}
        {disableInteractivity}
        disableUnitChange={disableXUnitChanges}
        hideTicks={hideXTicks}
        on:shift={(d) => chart?.shiftRange(d)}
        on:reset={() => chart?.resetZoom("x")}
        raiseFactor={chart?.raiseXFactorAction ?? cons(undefined)}
        lowerFactor={chart?.lowerXFactorAction ?? cons(undefined)}
        resetUnit={chart?.resetXFactorAction ?? cons(undefined)}
        bind:textLength={xAxisTextSize}
        dimensionFlock={commonXAxisHeight}
      />

      <Guidelines
        xTicks={hideXGuidelines ? [] : $xTicks ?? []}
        yTicks={hideYGruidelines ? [] : $yTicks ?? []}
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
        {chart}
        {visibleAction}
        {hideHoverPoints}
        {hideXRuler}
        {hideYRuler}
        {hideXBubble}
        {hideYBubble}
        {hoverXQuantity}
        {hoverYQuantity}
        {disableInteractivity}
        {presYThreshFracs}
        {commonXRuler}
        {commonYRuler}
        bind:filterByThreshold
        bind:addPersistentThreshold
        traceHovered={selectedTrace !== undefined}
        on:reset={() => chart?.resetZoom("xy")}
        on:zoom={(d) => chart?.zoomRange(d)}
        on:shift={(d) => chart?.shiftRange(d)}
        on:yThreshold={(t) => {
          if (t.detail.type === "persistent") {
            const thresholdQ = chart?.fractionsToQuantities(
              1 - t.detail.thresholdFrac,
              "y",
            );
            if (thresholdQ) persistentYThresholds.push(thresholdQ);
            persistentYThresholds = persistentYThresholds;
          }
          if (t.detail.type === "filtering")
            hiddenTraceIds.update((curr) => {
              for (const id of chart?.idsUnderThreshold(t) ?? []) curr.add(id);
              return curr;
            });
        }}
        on:mousemove={(e) => {
          showTooltip = true;
          updateHoverQuantities(e);
        }}
        on:mouseout={() => {
          showTooltip = false;
          closestTraces = [];
          visibleAction.update((action) => ({
            ...action,
            highlightedPoints: [],
          }));
          commonXRuler.set(undefined);
          commonYRuler.set(undefined);
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
            {hiddenTraceIds}
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
            {hiddenTraceIds}
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
    background-color: inherit;
    z-index: 100;
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

    background: var(--accent-color);
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
      background-color: var(--accent-color);
    }
  }
</style>
