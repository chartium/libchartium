<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Chart from "./lib/chart/Chart.svelte";
  import { spawnChartiumWorker } from "./lib/data-worker";
  import type { TraceDescriptor } from "./lib/data-worker/renderers/mod";

  // autogenerate a lot of data
  const from = 0;
  const to = 2 * Math.PI;
  const numSteps = 60;
  const stepSize = (to - from) / (numSteps - 1);
  
  
  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize
  );
  const y1s = xs.map((x) => Math.sin(x));
  const y2s = xs.map((x) => Math.cos(x));
  const y3s = xs.map((x) => Math.atan(x));
  const chartiumFriendlyTraceData = xs.flatMap((x, index) => [
    x,
    y1s[index],
    //y2s[index],
    //y3s[index],
  ]);
  
  const controller = spawnChartiumWorker();
  $: traces = controller
    .addFromArrayBuffer({
      ids: ["sin"],
      data: Float32Array.from(chartiumFriendlyTraceData),
      xType: "f32",
      yType: "f32",
    })
    .then((handles) => handles.map<TraceDescriptor>((handle) => ({ handle })));
</script>

<main>
  <div>
    <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>
  <h1>Vite + Svelte</h1>
  <p>
    Check out <a
      href="https://github.com/sveltejs/kit#readme"
      target="_blank"
      rel="noreferrer">SvelteKit</a
    >, the official Svelte app framework powered by Vite!
  </p>

  <p class="read-the-docs">Click on the Vite and Svelte logos to learn more</p>

  {#await traces then traces}
    <Chart
      {controller}
      {traces}
      xLabel="Time since I sagged yer mum [Days]"
      yLabel="Mean color of balls [K]"
      chartHeight={600}
      chartWidth={800}
      xAxisHeight={150}
      yAxisWidth={150}
    />
  {/await}
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
</style>
