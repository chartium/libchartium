<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Chart from "./lib/Chart.svelte";
  import { spawnChartiumWorker } from "./lib/data-worker";
  import type { TraceDescriptor } from "./lib/data-worker/modes/mod";

  const controller = spawnChartiumWorker();
  $: traces = controller
    .addFromArrayBuffer({
      ids: ["foo", "bar"],
      data: Uint32Array.from([10, 20, 30, 50, 80, 100]),
      xType: "u32",
      yType: "u32",
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

  <div class="card">
    {#await traces then traces}
      <Chart {controller} {traces} />
    {/await}
  </div>

  <p>
    Check out <a
      href="https://github.com/sveltejs/kit#readme"
      target="_blank"
      rel="noreferrer">SvelteKit</a
    >, the official Svelte app framework powered by Vite!
  </p>

  <p class="read-the-docs">Click on the Vite and Svelte logos to learn more</p>
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
