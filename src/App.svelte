<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Chart from "./lib/Chart.svelte";
  import { spawnChartiumWorker, ChartiumController } from "./lib/data-worker";

  // const controller = spawnChartiumWorker();
  const controller = ChartiumController.instantiateInThisThread();

  $: traces = controller.addFromArrayBuffer({
    ids: ["foo", "bar"],
    data: Float32Array.from([1, 0, 1, 25, 0, -1, 50, 0, 0, 75, 0, 1]),
    xType: "f32",
    yType: "f32",
  });

  // FIXME DEBUG
  $: (window as any).controller = controller;
  $: traces.then((t) => ((window as any).traces = t));
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
