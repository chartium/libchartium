<script lang="ts">
  import { type Remote } from "comlink";
  import type { ChartiumController } from "../data-worker";
  import type { TraceDescriptor } from "../data-worker/renderers/mod";
  import type { Range } from "../types";
  
  import { Chart } from "./chart";
  import ChartOverlay from "./ChartOverlay.svelte";
  import ChartAxis from "./ChartAxis.svelte";
  import { onMount } from "svelte";

  import ChartLegend from "./ChartLegend.svelte";

  /** Height of only the chart are without axis */
  export let chartHeight: number;
  /** Height of only the x axis, its width is automatically == chart width */
  export let axisHeight: number;
  /** Width of only the chart are without axis */
  export let chartWidth: number;
  /** Width of only the y axis, its height is automatically == chart height */
  export let axisWidth: number;
  export let controller: Remote<ChartiumController>;
  export let traces: TraceDescriptor[];
  /** Label to be displayed next to x axis */
  export let xLabel: string;
  /** Label to be displayed next to y axis */
  export let yLabel: string;

  let xTicks = [
    { pos: 0, value: 0 },
    { pos: 0.333, value: 2/3 * Math.PI },
    { pos: 0.667, value: 4/3 * Math.PI },
    { pos: 1, value: 2 * Math.PI },
  ]; // FIXME populate these
  let yTicks = [
    { pos: 0, value: -1 },
    { pos: 0.5, value: 0 },
    { pos: 1, value: 1 },
  ]; // FIXME populate these

  const chart = new Chart(controller);

  let canvas: HTMLCanvasElement | undefined;

  onMount(async () => {
    await chart.assignCanvas(canvas!);
    chart.includeTraces = await traces;
    chart.xType = "f32";
    chart.xRange = { from: 0, to: 2*Math.PI };
    chart.yRange = { from: -1, to: 1 };
  });

  $: (window as any).chart = chart; // FIXME DEBUG

  let zoomOrMove: "zoom" | "move" | "neither" = "neither";

  // for data
  /** new border values of y range */
  let yTransformValues: Range | undefined;
  /** new border values of x range */
  let xTransformValues:  Range | undefined;
  //$: {
  //  console.log("new ranges:")
  //  console.log(xTransformValues)
  //  console.log(yTransformValues)
  //}

  $: console.log(zoomOrMove)

  // for drawing
  /** new border values of y range */
  let yTransformPositions: Range | undefined;
  /** new border values of x range */
  let xTransformPositions:  Range | undefined;
  function changeRange() {
    if (xTransformValues !== undefined ) {chart.xRange = xTransformValues};
    if (yTransformValues !== undefined ) {chart.yRange = yTransformValues};
  }

</script>

<ChartOverlay
  overlayHeight={chartHeight + axisHeight}
  overlayWidth={chartWidth + axisWidth}
  {changeRange}
  bind:yAxisWidth={axisWidth}
  bind:xTransformPositions
  bind:yTransformPositions
  bind:zoomOrMove
>
  <ChartAxis
    label={yLabel}
    axis="y"
    axisHeight={chartHeight}
    {axisWidth}
    ticks={yTicks ?? []}
    slot="yAxis"
    bind:movePosition={yTransformPositions}
    bind:moveValue={yTransformValues}
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
    {axisHeight}
    axisWidth={chartWidth}
    ticks={xTicks ?? []}
    slot="xAxis"
    bind:movePosition={xTransformPositions}
    bind:moveValue={xTransformValues}
    bind:zoomOrMove
  />
</ChartOverlay>
