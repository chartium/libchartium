<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
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
  const y1s = xs.map((x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI));
  const y2s = xs.map((x) => 100 + 100 * Math.cos((x / to) * 2 * Math.PI));
  const y3s = xs.map(
    (x) => 100 + 100 * Math.tanh((x / to - 0.5) * 2 * Math.PI)
  );
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
    data: Float32Array.from(chartiumFriendlyTraceData),
    xType: "f32",
    yType: "f32",
  });
</script>

<main>
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <Chart
      {controller}
      {traces}
      title="Titulek"
      subtitle="Podtitulek"
      xLabel="Time since I sagged yer mum [Days]"
      yLabel="Mean color of balls [K]"
      chartHeight={600}
      chartWidth={800}
    />
  {/await}
</main>
