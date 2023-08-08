<script lang="ts">
  import { type Remote } from "comlink";
  import type { ChartiumController } from "../data-worker";
  import type { TraceDescriptor } from "../data-worker/renderers/mod";
  import { Chart } from "./chart";
    import { onMount } from "svelte";

  export let controller: Remote<ChartiumController>;
  export let traces: TraceDescriptor[];

  const chart = new Chart(controller);

  let canvas: HTMLCanvasElement | undefined;

  onMount(async () => {
    await chart.assignCanvas(canvas!);
    chart.includeTraces = await traces;
    chart.xType = "f32";

  })
  $: (window as any).chart = chart;
</script>

<canvas bind:this={canvas} width="600" height="600" />
