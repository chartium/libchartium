<script lang="ts">
  import { type Remote } from "comlink";
  import type { ChartiumController } from "../data-worker";
  import type { Range, Shift, Tick, Zoom } from "../types";

  import { Chart } from "./chart";
  import ChartOverlay from "./ChartOverlay.svelte";
  import ChartAxis from "./ChartAxis.svelte";
  import { onMount } from "svelte";

  import ChartLegend from "./ChartLegend.svelte";
  import type { ReadableSignal } from "../../utils/signal";
  import type { TraceList } from "../data-worker/trace-list";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";

  /** Height of only the chart are without axis */
  export let chartHeight: number;
  /** Height of only the x axis, its width is automatically == chart width */
  /** Width of only the chart are without axis */
  export let chartWidth: number;
  export let controller: ChartiumController;
  export let traces: TraceList;

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis */
  export let yLabel: string = "";

  const chart = new Chart(controller, traces);

  $: xTicks = [] as Tick[];
  $: yTicks = [] as Tick[];

  let canvas: HTMLCanvasElement;

  let mounted = false;
  onMount(async () => {
    await chart.assignCanvas(canvas!);
    mounted = true;

    chart.traces = await traces;
    chart.xType = "u32";
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

  let zoomOrMove: "zoom" | "move" | "neither" = "neither";

  // for data
  /** new border values of y range */
  let yTransformValues: Range | undefined;
  /** new border values of x range */
  let xTransformValues: Range | undefined;

  // for drawing
  /** new border values of y range */
  let yTransformPositions: Range | undefined;
  /** new border values of x range */
  let xTransformPositions: Range | undefined;

  function shiftRange({ detail: shift }: { detail: Shift }) {
    if (chart.xRange && shift.dx) {
      const delta = (chart.xRange.to - chart.xRange.from) * shift.dx;
      chart.xRange = {
        from: chart.xRange.from + delta,
        to: chart.xRange.to + delta,
      };
    }

    if (chart.yRange && shift.dy) {
      const delta = (chart.yRange.to - chart.yRange.from) * shift.dy;
      chart.yRange = {
        from: chart.yRange.from + delta,
        to: chart.yRange.to + delta,
      };
    }
  }

  function zoomRange({ detail }: { detail: Zoom }) {
    console.log(detail);
    for (const [axis, zoom] of Object.entries(detail) as [string, Range][]) {
      const rangeName = `${axis}Range` as "xRange" | "yRange";
      const range = chart[rangeName];

      if (!range) continue;

      const d = range.to - range.from;

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

    xTransformPositions = undefined;
    yTransformPositions = undefined;
    xTransformValues = undefined;
    yTransformValues = undefined;
  }

  let contentSize: [number, number] = [1, 1];
  $: if (chart && mounted && contentSize) {
    chart.renderer?.setSize(
      contentSize[0] * devicePixelRatio,
      contentSize[1] * devicePixelRatio
    );
    chart?.render();
  }
</script>

<div style="width:{chartWidth}px;height:{chartHeight}px">
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
      on:shift={shiftRange}
      bind:transformPosition={yTransformPositions}
      bind:transformValue={yTransformValues}
    />

    <AxisTicks
      slot="xticks"
      axis="x"
      ticks={xTicks ?? []}
      on:shift={shiftRange}
      bind:transformPosition={xTransformPositions}
      bind:transformValue={xTransformValues}
    />

    <canvas bind:this={canvas} on:contextmenu|preventDefault />

    <ChartOverlay
      on:reset={resetRange}
      on:zoom={zoomRange}
      on:shift={shiftRange}
      bind:xTransformPositions
      bind:yTransformPositions
      bind:zoomOrMove
    />
  </ChartGrid>
</div>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
