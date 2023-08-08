<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Chart from "./lib/chart/Chart.svelte";
  import { spawnChartiumWorker } from "./lib/data-worker";
  import type { TraceDescriptor } from "./lib/data-worker/renderers/mod";
  import ChartAxis from "./lib/chart/ChartAxis.svelte";

  const controller = spawnChartiumWorker();
  $: traces = controller
    .addFromArrayBuffer({
      ids: ["foo", "bar"],
      data: Float32Array.from([1, 0, 1, 25, 0, -1, 50, 0, 0, 75, 0, 1]),
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
  <div class="parent">
    <div class="div1">
      <ChartAxis
        label="Mean color of balls [K]"
        axis="y"
        axisHeight={600}
        axisWidth={40}
        ticks={[0, 1, 2, 3, 4]}
      />
    </div>
    <div class="div4">
      {#await traces then traces}
        <Chart {controller} {traces} />
      {/await}
    </div>
    <div class="div3">
      <ChartAxis
        label="Time since I shagged yer mum [days]"
        axis="x"
        axisHeight={40}
        axisWidth={600}
        ticks={[0, 1, 2, 3, 4]}
      />
    </div>
    <div class="div2" />
  </div>
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

  .parent {
    display: grid;
    grid-template-columns: 1fr 3fr;
    grid-template-rows: 3fr 1fr;
    grid-column-gap: 0px;
    grid-row-gap: 0px;
  }

  .div1 {
    grid-area: 1 / 1 / 2 / 2;
    display:flex;
    justify-content: end;
  }
  .div2 {
    grid-area: 2 / 1 / 3 / 2;
  }
  .div3 {
    grid-area: 2 / 2 / 3 / 3;
  }
  .div4 {
    grid-area: 1 / 2 / 2 / 3;
  }
</style>
