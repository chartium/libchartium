<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
  import ChartGrid from "./lib/chart/ChartGrid.svelte";
  import { ChartiumController } from "./lib/data-worker";

  // autogenerate a lot of data
  const from = 0;
  const to = 1000;
  const numSteps = to;
  const stepSize = (to - from) / numSteps;

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize
  );
  const y1s = xs.map((x) => 100 * Math.sin((x / to) * 2 * Math.PI));
  const y2s = xs.map((x) => 100 * Math.cos((x / to) * 2 * Math.PI));
  const y3s = xs.map((x) => 100 * Math.tanh((x / to - 0.5) * 2 * Math.PI));
  const chartiumFriendlyTraceData = xs.flatMap((x, index) => [
    x,
    y1s[index],
    y2s[index],
    y3s[index],
  ]);

  // const controller = spawnChartiumWorker();
  const controller = ChartiumController.instantiateInThisThread();
  $: traces = controller.addFromArrayBuffer({
    ids: ["sin", "cos", "atan"],
    data: Uint32Array.from(chartiumFriendlyTraceData),
    xType: "u32",
    yType: "u32",
  });
</script>

<main>
  <h1>Chartium test page</h1>

  <div class="frame">
    <ChartGrid>
      <svelte:fragment slot="title">Title</svelte:fragment>
      <svelte:fragment slot="subtitle">Subtitle</svelte:fragment>
      <svelte:fragment slot="ylabel">Osa Y</svelte:fragment>
      <svelte:fragment slot="yticks"><span>Y ticks</span></svelte:fragment>
      <svelte:fragment slot="xlabel">Osa X</svelte:fragment>
      <svelte:fragment slot="xticks">X ticks</svelte:fragment>
      <!-- <svelte:fragment slot="right-legend">Right legend</svelte:fragment> -->
      <!-- <svelte:fragment slot="bottom-legend">Bottom legend</svelte:fragment> -->
    </ChartGrid>
  </div>

  {#await traces then traces}
    <Chart
      {controller}
      {traces}
      xLabel="Time since I sagged yer mum [Days]"
      yLabel="Mean color of balls [K]"
      chartHeight={600}
      chartWidth={800}
    />
  {/await}
</main>

<style>
  .frame {
    width: 800px;
    height: 600px;
    border: 1px solid white;
    border-radius: 8px;

    overflow: hidden;
  }
</style>
