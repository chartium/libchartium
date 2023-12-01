<script lang="ts">
  import type { ChartiumController } from "../data-worker/index.js";
  import type {
    Range,
    Shift,
    Quantity,
    Zoom,
    NumericRange,
    Unit,
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
  import Tooltip from "./Tooltip.svelte";
  import { norm } from "./position.js";
  import { cons, mut } from "@mod.js/signals";
  import type { Remote } from "comlink";
  import { toNumeric, toRange } from "../utils/quantityHelpers.js";
  import type dayjs from "dayjs";
  import { qndFormat } from "../utils/format.js";

  // SECTION Props

  export let controller: ChartiumController | Remote<ChartiumController>;
  export let traces: TraceList;

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis. If empty, label will be ommited */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis. If empty, label will be ommited */
  export let yLabel: string = "";

  /** Units that should be used on the x axis. If undefined, the units of the data are used. */
  export let xUnit: Unit | undefined = undefined;

  /** Units that should be used on the y axis. If undefined, the units of the data are used. */
  export let yUnit: Unit | undefined = undefined;

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

  /** Hides the tooltips shown next to cursor */
  export let hideTooltip: boolean = false;
  /** Sets the number of traces that are shown in the tooltip by users keyboard */
  export let tooltipTracesShown: number | "all" = 2;
  /** Hides the highlighted points on traces that the tooltip is showing info about */
  export let hideHoverPoints: boolean = false;

  export let legendPosition: "none" | "right" | "bottom" = "right";
  /** Refers to the little trace sample, simplified just shows color, full shows real width and stroke style */
  export let legendPreview: "simplified" | "full" = "simplified";
  /** How many traces to show in the legend, the rest will be hidden behind a button */
  export let legendTracesShown: number | "all" = "all";

  /** Disables zooming and moving */ // TODO should this include context menu?
  export let disableInteractivity: boolean = false;

  /** Sets position of the lil infobox that shows number of traces and range */
  export let infoboxPosition:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "none" = "top-right";

  /** if true, chart will listen to mouseclick to apply a threshold */
  export let thresholdMode: boolean = false;

  //!SECTION

  let canvas: HTMLCanvasElement;

  $: offscreenCanvas = canvas ? canvas.transferControlToOffscreen() : undefined;
  let chart: Chart | undefined = undefined;
  $: if (offscreenCanvas) {
    // FIXME oh boy will this trigger an infinite loop?
    chart = new Chart(controller, offscreenCanvas, traces);
    chart.traces.subscribe((t) => {
      traces = t;
    });
  }
  $: xTicks = chart?.xTicks;
  $: yTicks = chart?.yTicks;

  $: if (xUnit) chart?.xDisplayUnit.set(xUnit);
  $: if (yUnit) chart?.yDisplayUnit.set(yUnit);
  $: xDisplayUnit = chart?.xDisplayUnit;
  $: yDisplayUnit = chart?.yDisplayUnit;

  $: qndFormatOptions = {
    decimals: 2,
    dayjsFormat: "MMM DD, hh:mm:ss",
    unit: $yDisplayUnit,
  };
  const visibleAction = mut<VisibleAction | undefined>(undefined);

  $: (window as any).chart = chart; // FIXME DEBUG

  let contentSize: [number, number] = [1, 1];
  $: if (chart) {
    chart.size.set({
      width: contentSize[0] * devicePixelRatio,
      height: contentSize[1] * devicePixelRatio,
    });
  }

  let showTooltip: boolean = false;
  let hoverXQuantity: number | dayjs.Dayjs | Quantity;
  let hoverYQuantity: number | dayjs.Dayjs | Quantity;
  $: closestTraces =
    chart && hoverXQuantity && hoverYQuantity
      ? traces.findClosestTracesToPoint(
          {
            x: hoverXQuantity,
            y: hoverYQuantity,
          },
          tooltipTracesShown === "all" ? traces.traceCount : tooltipTracesShown
        )
      : undefined;
  $: tracesInfo =
    closestTraces?.map((trace) => ({
      styledTrace: trace.traceInfo,
      x: qndFormat(trace.closestPoint.x, qndFormatOptions),
      y: qndFormat(trace.closestPoint.y, qndFormatOptions),
    })) ?? [];

  $: {
    if (closestTraces === undefined || chart === undefined) {
      visibleAction.set({ highlightedPoints: [] });
    } else {
      const points = closestTraces.map((trace) => ({
        xFraction: chart!.quantitiesToFractions(trace.closestPoint.x, "x"),
        yFraction: chart!.quantitiesToFractions(trace.closestPoint.y, "y"),
        color: trace.traceInfo.color,
        radius: trace.traceInfo.width,
      }));

      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: points,
      }));
    }
  }

  /** How close to a trace is considered close enough to get only one trace info */
  const closenessDistance = 6;
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
      chart.distanceInDataUnits(closestTraces[0].closestPoint, {
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
    const { from, to } = chart.xRange.get();
    const statsOfClosest = traces.calculateStatistics({
      traces: [closestTraces[0].traceInfo.id],
      from,
      to,
    })[0];

    selectedTrace = {
      // NOTE move unit logic to rust? prolly not
      styledTrace: closestTraces[0].traceInfo,
      x: qndFormat(closestTraces[0].closestPoint.x, qndFormatOptions),
      y: qndFormat(closestTraces[0].closestPoint.y, qndFormatOptions),
      min: qndFormat(statsOfClosest.min, qndFormatOptions),
      max: qndFormat(statsOfClosest.max, qndFormatOptions),
      avg: qndFormat(statsOfClosest.avg, qndFormatOptions),
    };
  } else {
    selectedTrace = undefined;
  }

  function updateHoverQuantities(e: MouseEvent) {
    hoverXQuantity = chart?.coordinatesToQuantities(e.offsetX, "x") ?? 0;
    hoverYQuantity = chart?.coordinatesToQuantities(e.offsetY, "y") ?? 0;
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
    })
  );

  $: (window as any).thresholdMode_ENGAGE = () => (thresholdMode = true);
</script>

{#if !hideTooltip}
  <Tooltip
    {forbiddenRectangle}
    nearestTracesInfo={tracesInfo}
    singleTraceInfo={selectedTrace}
    show={showTooltip}
  />
{/if}

<ChartGrid bind:contentSize>
  <svelte:fragment slot="ylabel">
    {yLabel}
    {#if !hideYLabelUnits && $yDisplayUnit}[{$yDisplayUnit.toString()}]{/if}
  </svelte:fragment>
  <svelte:fragment slot="xlabel">
    {xLabel}
    {#if !hideXLabelUnits && $xDisplayUnit}[{$xDisplayUnit.toString()}]{/if}
  </svelte:fragment>
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
    {visibleAction}
    {disableInteractivity}
    hideTicks={hideYTicks}
    on:shift={(d) => chart?.shiftRange(d)}
    raiseFactor={chart?.raiseYFactorAction ?? cons(undefined)}
    lowerFactor={chart?.lowerYFactorAction ?? cons(undefined)}
  />

  <AxisTicks
    slot="xticks"
    axis="x"
    ticks={$xTicks ?? []}
    {visibleAction}
    {disableInteractivity}
    hideTicks={hideXTicks}
    on:shift={(d) => chart?.shiftRange(d)}
    raiseFactor={chart?.raiseXFactorAction ?? cons(undefined)}
    lowerFactor={chart?.lowerXFactorAction ?? cons(undefined)}
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
    {visibleAction}
    {hideHoverPoints}
    {hideXRuler}
    {hideYRuler}
    {disableInteractivity}
    bind:thresholdMode
    traceHovered={selectedTrace !== undefined}
    on:reset={() => chart?.resetZoom()}
    on:zoom={(d) => chart?.zoomRange(d)}
    on:shift={(d) => chart?.shiftRange(d)}
    on:yThreshold={(t) => chart?.filterOverTreshold(t)}
    on:mousemove={(e) => {
      showTooltip = true;
      updateHoverQuantities(e);
    }}
    on:mouseout={(e) => {
      showTooltip = false;
      closestTraces = [];
      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: [],
      }));
    }}
    on:blur={(e) => {
      showTooltip = false;
    }}
  />

  <div class="toolbar" slot="overlay">
    <slot name="toolbar" />
  </div>

  <svelte:fragment slot="right-legend">
    {#if legendPosition === "right"}
      <ChartLegend
        {traces}
        previewType={legendPreview}
        numberOfShownTraces={legendTracesShown === "all"
          ? traces.traceCount
          : legendTracesShown}
      />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="bottom-legend">
    {#if legendPosition === "bottom"}
      <ChartLegend
        {traces}
        previewType={legendPreview}
        numberOfShownTraces={legendTracesShown === "all"
          ? traces.traceCount
          : legendTracesShown}
      />
    {/if}
  </svelte:fragment>
</ChartGrid>

<style lang="scss">
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .infobox {
    position: absolute;

    text-align: left;
    padding: 0.25rem;

    font-size: 0.8em;
    max-width: 300px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    background: rgba(255, 255, 255, 0.6);

    :global(.dark) & {
      background: rgba(70, 70, 70, 0.6);
    }
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
      background-color: #ececec;
    }

    :global(.dark) &:hover {
      background-color: #505050;
    }
  }
</style>
