<script lang="ts">
  import { transfer, type Remote } from "comlink";
  import type { ChartiumController } from "./data-worker";
  import { mapOpt } from "../utils/mapOpt";
  import type { TraceDescriptor } from "./data-worker/renderers/mod";
  import { Chart } from "./chart";
    import { onMount } from "svelte";

  export let controller: Remote<ChartiumController>;
  export let traces: TraceDescriptor[];

  const chart = new Chart(controller);

  let canvas: HTMLCanvasElement | undefined;

  onMount(async () => {
    await chart.assignCanvas(canvas!);
    chart.includeTraces = traces;
    chart.xType = "f32";
    chart.xRange = { from: 0, to: 100 };
    chart.yRange = { from: -2, to: 2 };
  })

  $: (window as any).chart = chart;


</script>

<canvas bind:this={canvas} width="100" height="100" />
