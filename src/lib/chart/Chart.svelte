<script lang="ts">
  import type { ChartiumController } from "../data-worker/index.js";
  import type { Range, Shift, Quantity, Zoom } from "../types.js";
  import type { TraceInfo, TraceList } from "../data-worker/trace-list.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";

  import { onDestroy, onMount } from "svelte";
  import { Chart } from "./chart.js";

  import ChartOverlay from "./ActionsOverlay.svelte";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";
  import ChartLegend from "./Legend.svelte";
  import Guidelines from "./Guidelines.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { norm } from "./position.js";
  import { cons, mut } from "@mod.js/signals";
  import type { Remote } from "comlink";

  export let controller: ChartiumController | Remote<ChartiumController>;
  export let traces: TraceList;

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis. If empty label will be ommited */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis. If empty label will be ommited */
  export let yLabel: string = "";

  // SECTION Props

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

  //!SECTION

  let canvas: HTMLCanvasElement;

  $: chart = canvas ? new Chart(controller, canvas, traces) : undefined;
  $: xTicks = chart?.xTicks;
  $: yTicks = chart?.yTicks;
  let xDisplayUnit: Unit | undefined;
  let yDisplayUnit: Unit | undefined;
  chart?.xRange.subscribe(
    (range) =>
      (xDisplayUnit =
        range.from instanceof Quantity ? range.from.unit : undefined)
  );
  chart?.yRange.subscribe(
    (range) =>
      (yDisplayUnit =
        range.from instanceof Quantity ? range.from.unit : undefined)
  );

  const visibleAction = mut<VisibleAction | undefined>(undefined);

  $: (window as any).chart = chart; // FIXME DEBUG

  function shiftRange({ detail: shift }: { detail: Shift }) {
    if (!chart) return;

    {
      const xRange = chart.xRange.get();
      const xUnits = chart.xDataUnit.get();
      const from = toNumeric(xRange.from, xUnits);
      const to = toNumeric(xRange.to, xUnits);
      if (shift.dx) {
        const delta = (to - from) * -shift.dx;
        chart.xRange.set({
          from: toQuantity(from + delta, xUnits),
          to: toQuantity(to + delta, xUnits),
        } as Range);
      }
    }
    {
      const yRange = chart.yRange.get();
      const yUnits = chart.yDataUnit.get();
      const from = toNumeric(yRange.from, yUnits);
      const to = toNumeric(yRange.to, yUnits);
      if (shift.dy) {
        const delta = (to - from) * -shift.dy;
        chart.yRange.set({
          from: toQuantity(from + delta, yUnits),
          to: toQuantity(to + delta, yUnits),
        } as Range);
      }
    }
  }

  function zoomRange({ detail }: { detail: Zoom }) {
    if (!chart) return;

    for (const [axis, zoom] of Object.entries(detail) as [
      string,
      NumericRange
    ][]) {
      const rangeName = `${axis}Range` as "xRange" | "yRange";
      const range = chart[rangeName].get();
      const unit =
        rangeName === "xRange" ? chart.xDataUnit.get() : chart.yDataUnit.get();

      const d = toNumeric(range.to, unit) - toNumeric(range.from, unit);

      if (zoom.to - zoom.from <= 0) continue;

      chart[rangeName].set({
        from: toQuantity(toNumeric(range.from, unit) + d * zoom.from, unit),
        to: toQuantity(toNumeric(range.from, unit) + d * zoom.to, unit),
      } as Range);
    }
  }

  let contentSize: [number, number] = [1, 1];
  $: if (chart) {
    chart.size.set({
      width: contentSize[0] * devicePixelRatio,
      height: contentSize[1] * devicePixelRatio,
    });
  }

  let showTooltip: boolean = false;
  let hoverXQuantity: number | Quantity; // Silly goofy way to make it too far from everything on mount
  let hoverYQuantity: number | Quantity;
  $: closestTraces =
    chart && hoverXQuantity && hoverYQuantity
      ? traces.findClosestTracesToPoint(
          {
            x: toNumeric(hoverXQuantity, chart?.xDataUnit.get()),
            y: toNumeric(hoverYQuantity, chart?.yDataUnit.get()),
          },
          tooltipTracesShown === "all" ? traces.traceCount : tooltipTracesShown
        )
      : undefined;
  $: tracesInfo =
    closestTraces?.map((trace) => ({
      styledTrace: trace.traceInfo,
      x: toQuantity(trace.closestPoint.x, chart?.xDataUnit.get()),
      y: toQuantity(trace.closestPoint.y, chart?.xDataUnit.get()),
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
        x: Quantity | number;
        y: Quantity | number;
        min: Quantity | number;
        max: Quantity | number;
        avg: Quantity | number;
      }
    | undefined = undefined;

  let traceCloseEnough: boolean;

  $: if (chart && closestTraces && closestTraces?.length !== 0) {
    traceCloseEnough =
      norm([
        closestTraces[0].closestPoint.x -
          toNumeric(hoverXQuantity, chart.xDataUnit.get()),
        closestTraces[0].closestPoint.y -
          toNumeric(hoverYQuantity, chart.yDataUnit.get()),
      ]) < closenessDistance;
  }

  // look for the closest trace to the mouse and if it's close enough, show more info
  $: if (
    chart &&
    closestTraces !== undefined &&
    closestTraces?.length !== 0 &&
    traceCloseEnough
  ) {
    const { from, to } = chart.xRange.get();
    const closestMeta = traces.calculateStatistics({
      traces: [closestTraces[0].traceInfo.id],
      from: toNumeric(from, chart.xDataUnit.get()), // FIXME move the unit logic a bit deeper int othe traces as well
      to: toNumeric(to, chart.xDataUnit.get()), // FIXME move the unit logic a bit deeper int othe traces as well
    })[0];

    selectedTrace = {
      // FIXME move unit logic to rust?
      styledTrace: closestTraces[0].traceInfo,
      x: toQuantity(closestTraces[0].closestPoint.x, chart.xDataUnit.get()),
      y: toQuantity(closestTraces[0].closestPoint.y, chart.yDataUnit.get()),
      min: toQuantity(closestMeta.min, chart.yDataUnit.get()),
      max: toQuantity(closestMeta.max, chart.yDataUnit.get()),
      avg: toQuantity(closestMeta.avg, chart.yDataUnit.get()),
    };
  } else {
    selectedTrace = undefined;
  }

  $: if (selectedTrace !== undefined) {
    // FIXME ew but im unsure to what style to put it
    document.body.style.cursor = "crosshair";
  } else {
    document.body.style.cursor = "default";
  }

  function updateHoverValues(e: MouseEvent) {
    const xFraction = e.offsetX / canvas.clientWidth;
    const yFraction = e.offsetY / canvas.height;

    hoverXQuantity = chart?.fractionsToQuantities(xFraction, "x") ?? 0;
    hoverYQuantity = chart?.fractionsToQuantities(yFraction, "y") ?? 0;
  }

  let forbiddenRectangle:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined = undefined;

  onDestroy(
    visibleAction.subscribe((action) => {
      if (!chart) return;
      if (action?.zoom) {
        const canvasRect = chart.canvas!.getBoundingClientRect();
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
    {#if !hideYLabelUnits && yDisplayUnit}[{yDisplayUnit.toString()}]{/if}
  </svelte:fragment>
  <svelte:fragment slot="xlabel">
    {xLabel}
    {#if !hideXLabelUnits && xDisplayUnit}[{xDisplayUnit.toString()}]{/if}
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
    on:shift={shiftRange}
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
    on:shift={shiftRange}
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

  <ChartOverlay
    {visibleAction}
    {hideHoverPoints}
    {hideXRuler}
    {hideYRuler}
    {disableInteractivity}
    on:reset={() => chart?.resetZoom()}
    on:zoom={zoomRange}
    on:shift={shiftRange}
    on:mousemove={(e) => {
      showTooltip = true;
      updateHoverValues(e);
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
