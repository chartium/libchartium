<script lang="ts">
  import { type Remote } from "comlink";
  import type { ChartiumController } from "../data-worker";
  import type { TraceDescriptor } from "../data-worker/renderers/mod";
  import type { Range, Tick } from "../types";

  import { Chart } from "./chart";
  import ChartOverlay from "./ChartOverlay.svelte";
  import ChartAxis from "./ChartAxis.svelte";
  import { onMount } from "svelte";

  import ChartLegend from "./ChartLegend.svelte";
  import type { ReadableSignal } from "../../utils/signal";

  /** Height of only the chart are without axis */
  export let chartHeight: number;
  /** Height of only the x axis, its width is automatically == chart width */
  export let xAxisHeight: number;
  /** Width of only the chart are without axis */
  export let chartWidth: number;
  /** Width of only the y axis, its height is automatically == chart height */
  export let yAxisWidth: number;
  export let controller: Remote<ChartiumController>;
  export let traces: TraceDescriptor[];
  /** Label to be displayed next to x axis */
  export let xLabel: string;
  /** Label to be displayed next to y axis */
  export let yLabel: string;

  const chart = new Chart(controller);

  $: xTicks = [] as Tick[];
  $: yTicks = [] as Tick[];

  let canvas: HTMLCanvasElement | undefined;

  onMount(async () => {
    await chart.assignCanvas(canvas!);
    chart.xLabelSpace = 0;
    chart.yLabelSpace = 0;
    chart.margin = 0;
    chart.includeTraces = await traces;
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
    chart.yRange = { from: -1, to: 1 };

    xTransformPositions = undefined;
    yTransformPositions = undefined;
    xTransformValues = undefined;
    yTransformValues = undefined;
  }
</script>

<ChartOverlay
  overlayHeight={chartHeight + xAxisHeight}
  overlayWidth={chartWidth + yAxisWidth}
  {updateRange}
  {resetRange}
  bind:yAxisWidth
  bind:xTransformPositions
  bind:yTransformPositions
  bind:zoomOrMove
>
  <ChartAxis
    label={yLabel}
    axis="y"
    axisHeight={chartHeight}
    axisWidth={yAxisWidth}
    ticks={yTicks ?? []}
    slot="yAxis"
    {updateRange}
    axisOffset={0}
    bind:transformPosition={yTransformPositions}
    bind:transformValue={yTransformValues}
    bind:zoomOrMove
  />
  <canvas
    slot="chart"
    bind:this={canvas}
    width={chartWidth}
    height={chartHeight}
    on:contextmenu|preventDefault
  />
  <!-- TODO is disabling context menu here a good idea? -->
  <ChartAxis
    label={xLabel}
    axis="x"
    axisHeight={xAxisHeight}
    axisWidth={chartWidth}
    ticks={xTicks ?? []}
    slot="xAxis"
    {updateRange}
    axisOffset={yAxisWidth}
    bind:transformPosition={xTransformPositions}
    bind:transformValue={xTransformValues}
    bind:zoomOrMove
  />
</ChartOverlay>
