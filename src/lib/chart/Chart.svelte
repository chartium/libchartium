<script lang="ts">
  import type { ChartiumController } from "../data-worker";
  import type {
    HighlightPoint as HighlightedPoint,
    Range,
    Shift,
    Tick,
    Zoom,
  } from "../types";
  import type { TraceInfo, TraceList } from "../data-worker/trace-list";
  import type { VisibleAction } from "./ActionsOverlay.svelte";

  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { Chart } from "./chart";

  import ChartOverlay from "./ActionsOverlay.svelte";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";
  import ChartLegend from "./Legend.svelte";
  import Guidelines from "./Guidelines.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { norm } from "./position";

  export let controller: ChartiumController;
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

  const chart = new Chart(controller, traces);
  const { xTicks, yTicks, xDisplayUnit, yDisplayUnit } = chart;

  const visibleAction = writable<VisibleAction | undefined>(undefined);

  let canvas: HTMLCanvasElement;

  let mounted = false;
  onMount(async () => {
    await chart.assignCanvas(canvas!);
    mounted = true;

    chart.traces = await traces;
    chart.xType = "f32";
    chart.renderAxes = true;
    chart.xRange = { from: 0, to: 1000 };
    chart.yRange = { from: -10, to: 200 };
  });

  $: (window as any).chart = chart; // FIXME DEBUG

  function shiftRange({ detail: shift }: { detail: Shift }) {
    if (chart.xRange && shift.dx) {
      const delta = (chart.xRange.to - chart.xRange.from) * -shift.dx;
      chart.xRange = {
        from: chart.xRange.from + delta,
        to: chart.xRange.to + delta,
      };
    }

    if (chart.yRange && shift.dy) {
      const delta = (chart.yRange.to - chart.yRange.from) * -shift.dy;
      chart.yRange = {
        from: chart.yRange.from + delta,
        to: chart.yRange.to + delta,
      };
    }
  }

  function zoomRange({ detail }: { detail: Zoom }) {
    for (const [axis, zoom] of Object.entries(detail) as [string, Range][]) {
      const rangeName = `${axis}Range` as "xRange" | "yRange";
      const range = chart[rangeName];

      if (!range) continue;

      const d = range.to - range.from;

      if (zoom.to - zoom.from <= 0) continue;

      chart[rangeName] = {
        from: range.from + d * zoom.from,
        to: range.from + d * zoom.to,
      };
    }
  }

  let contentSize: [number, number] = [1, 1];
  $: if (chart && mounted && contentSize) {
    chart.renderer?.setSize(
      contentSize[0] * devicePixelRatio,
      contentSize[1] * devicePixelRatio
    );
    chart.render();
  }

  let showTooltip: boolean = false;
  let hoverXValue: number = Infinity; // Silly goofy way to make it too far from everything on mount
  let hoverYValue: number = Infinity;
  $: closestTraces = traces.findClosestTracesToPoint(
    { x: hoverXValue, y: hoverYValue },
    tooltipTracesShown === "all" ? traces.traceCount : tooltipTracesShown
  );
  $: tracesInfo =
    closestTraces?.map((trace) => ({
      styledTrace: trace.traceInfo,
      x: trace.closestPoint.x.toFixed(3),
      y: trace.closestPoint.y.toFixed(3),
    })) ?? [];

  $: {
    // Highlighted points for the overlay
    if (closestTraces === undefined) {
      visibleAction.set({ highlightedPoints: [] });
    } else if (chart.xRange !== undefined && chart.yRange !== undefined) {
      const points = closestTraces.map((trace) => ({
        xFraction:
          (trace.closestPoint.x - chart.xRange!.from) /
          (chart.xRange!.to - chart.xRange!.from),
        yFraction:
          (trace.closestPoint.y - chart.yRange!.from) /
          (chart.yRange!.to - chart.yRange!.from),
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

  // look for the closest trace to the mouse and if it's close enough, show more info
  $: if (
    closestTraces &&
    closestTraces?.length != 0 &&
    norm([
      closestTraces[0].closestPoint.x - hoverXValue,
      closestTraces[0].closestPoint.y - hoverYValue,
    ]) < closenessDistance
  ) {
    const closestMeta = traces.calculateMetas({
      traces: [closestTraces[0].traceInfo.id],
      from: chart.xRange?.from,
      to: chart.xRange?.to,
    })[0];

    selectedTrace = {
      styledTrace: closestTraces[0].traceInfo,
      x: closestTraces[0].closestPoint.x.toFixed(3),
      y: closestTraces[0].closestPoint.y.toFixed(3),
      min: closestMeta.min.toFixed(3),
      max: closestMeta.max.toFixed(3),
      avg: closestMeta.avg.toFixed(3),
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
    const xFraction = e.offsetX / canvas.clientWidth; // FIXME ew, this should be calculated somewhere smartly, its just lucky this canvas has the same size as the other one
    const yFraction = e.offsetY / canvas.height; // FIXME ew, this should be calculated somewhere smartly, its just lucky this canvas has the same size as the other one

    const { xRange, yRange } = chart;

    if (!xRange || !yRange) return;

    hoverXValue = xRange.from + (xRange.to - xRange.from) * xFraction;
    hoverYValue = yRange.from + (yRange.to - yRange.from) * (1 - yFraction);
  }
</script>

{#if !hideTooltip}
  <Tooltip
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
    on:shift={shiftRange}
  />

  <AxisTicks
    slot="xticks"
    axis="x"
    ticks={$xTicks ?? []}
    {visibleAction}
    {disableInteractivity}
    hideTicks={hideXTicks}
    on:shift={shiftRange}
  />

  <Guidelines
    xTicks={hideXGuidelines ? [] : $xTicks}
    yTicks={hideYGruidelines ? [] : $yTicks}
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
    on:reset={() => chart.resetZoom()}
    on:zoom={zoomRange}
    on:shift={shiftRange}
    on:mousemove={(e) => {
      showTooltip = true;
      updateHoverValues(e);
    }}
    on:mouseout={(e) => {
      showTooltip = false;
      closestTraces = [];
      hoverXValue = Infinity;
      hoverYValue = Infinity;
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
