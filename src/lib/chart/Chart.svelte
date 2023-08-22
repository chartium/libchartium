<script lang="ts">
  import { type Remote } from "comlink";
  import type { ChartiumController } from "../data-worker";
  import type { Range, Tick } from "../types";

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

  onMount(async () => {
    await chart.assignCanvas(canvas!);

    chart.xLabelSpace = 0;
    chart.yLabelSpace = 0;
    chart.margin = 0;
    chart.traces = await traces;
    chart.xType = "f32";
    chart.xRange = { from: 0, to: 2 * Math.PI };
    chart.yRange = { from: -1, to: 1 };

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

  function updateRange() {
    if (xTransformValues !== undefined) {
      chart.xRange =
        xTransformValues.from < xTransformValues.to
          ? xTransformValues
          : { from: xTransformValues.to, to: xTransformValues.from };
    }
    if (yTransformValues !== undefined) {
      chart.yRange =
        yTransformValues.from < yTransformValues.to
          ? yTransformValues
          : { from: yTransformValues.to, to: yTransformValues.from };
    }
  }
  function resetRange() {
    // FIXME this should pull data from controller
    chart.xRange = { from: 0, to: 1000 };
    chart.yRange = { from: -500, to: 500 };

    xTransformPositions = undefined;
    yTransformPositions = undefined;
    xTransformValues = undefined;
    yTransformValues = undefined;
  }

  let contentSize: [number, number] = [1, 1];
  $: if (chart) {
    chart.renderer?.setSize(contentSize[0], contentSize[1]);
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
      {updateRange}
      bind:transformPosition={yTransformPositions}
      bind:transformValue={yTransformValues}
      bind:zoomOrMove
    />

    <AxisTicks
      slot="xticks"
      axis="x"
      ticks={xTicks ?? []}
      {updateRange}
      bind:transformPosition={xTransformPositions}
      bind:transformValue={xTransformValues}
      bind:zoomOrMove
    />

    <canvas bind:this={canvas} on:contextmenu|preventDefault />
  </ChartGrid>
</div>

<!-- <ChartOverlay
  overlayHeight={chartHeight + xAxisHeight}
  overlayWidth={chartWidth + yAxisWidth}
  {updateRange}
  {resetRange}
  bind:yAxisWidth
  bind:xTransformPositions
  bind:yTransformPositions
  bind:zoomOrMove
> -->

<style>
  div {
    overflow: hidden;
  }

  canvas {
    position: absolute;
    inset: 0;
  }
</style>
