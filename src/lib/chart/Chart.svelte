<script lang="ts">
  import type { ChartiumController } from "../data-worker";
  import type { Range, Shift, Tick, Zoom } from "../types";
  import type { TraceList } from "../data-worker/trace-list";
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

  export let controller: ChartiumController;
  export let traces: TraceList;

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis */
  export let yLabel: string = "";

  const chart = new Chart(controller, traces);
  const visibleAction = writable<VisibleAction | undefined>(undefined);

  $: xTicks = [] as Tick[];
  $: yTicks = [] as Tick[];

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

    chart.xTicks?.subscribe((ticks) => {
      xTicks = ticks;
    });

    chart.yTicks?.subscribe((ticks) => {
      yTicks = ticks;
    });
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

  function resetRange() {
    // FIXME this should pull data from controller
    chart.xRange = { from: 0, to: 1000 };
    chart.yRange = { from: -10, to: 200 };
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
  let hoverXValue: number = 0;
  let hoverYValue: number = 0;
  const howManyTracesShownInTooltip = 2;
  $: closestTraces = traces.findClosestTracesToPoint({x: hoverXValue, y: hoverYValue}, howManyTracesShownInTooltip);
  $: traceInfo = closestTraces?.map(trace => ({
    traceId: trace.traceInfo.id,
    value: trace.closestPoint.y.toFixed(3),
  })) ?? [];
  function updateHoverValues(e: MouseEvent) {
    const xFraction = e.offsetX / canvas.clientWidth; // FIXME ew
    const yFraction = e.offsetY / canvas.height; // FIXME ew

    const { xRange, yRange } = chart;

    if (!xRange || !yRange) return;

    hoverXValue = xRange.from + (xRange.to - xRange.from) * xFraction;
    hoverYValue = yRange.from + (yRange.to - yRange.from) * (1 - yFraction);
  }
  
</script>

<Tooltip
  {traceInfo}
  header={`x: ${hoverXValue.toFixed(3)}`}
  show={showTooltip}
/>

<ChartGrid bind:contentSize>
  <svelte:fragment slot="ylabel">
    {yLabel}
  </svelte:fragment>
  <svelte:fragment slot="xlabel">
    {xLabel}
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
    ticks={yTicks ?? []}
    {visibleAction}
    on:shift={shiftRange}
  />

  <AxisTicks
    slot="xticks"
    axis="x"
    ticks={xTicks ?? []}
    {visibleAction}
    on:shift={shiftRange}
  />

  <Guidelines {xTicks} {yTicks} />
  <canvas bind:this={canvas} on:contextmenu|preventDefault />

  {#if $$slots.infobox}
    <div class="infobox">
      <slot name="infobox" />
    </div>
  {/if}

  <ChartOverlay
    on:reset={resetRange}
    on:zoom={zoomRange}
    on:shift={shiftRange}
    {visibleAction}

    on:mousemove={(e) => {
      showTooltip = true;
      updateHoverValues(e);
    }}
    on:mouseout={(e) => {
      showTooltip = false;
    }}
    on:blur={(e) => {
      showTooltip = false;
    }}

  />

  <div class="toolbar" slot="overlay">
    <slot name="toolbar" />
  </div>

  <ChartLegend slot="right-legend" {traces} />
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
    top: 0.5rem;
    right: 0.5rem;

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
