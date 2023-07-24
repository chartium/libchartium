<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Chart from "./lib/Chart.svelte";
  import { spawnChartiumWorker } from "./lib/data-worker";
  import type { TraceDescriptor } from "./lib/data-worker/renderers/mod";

  const controller = spawnChartiumWorker();
  $: traces = controller
    .addFromArrayBuffer({
      ids: ["foo", "bar"],
      data: Float32Array.from([1.0, 0.06279051952931337, 0.9980267284282716, 6.2105263157894735, 0.3803908473092647, 0.9248258232139388, 11.421052631578947, 0.6575828865506245, 0.7533822053352126, 16.63157894736842, 0.864920986861182, 0.5019080458481205, 21.842105263157894, 0.9803799658748094, 0.1971170274514805, 27.052631578947366, 0.991694807828494, -0.12861340570098587, 32.26315789473684, 0.8976635558358722, -0.44068145017018584, 37.473684210526315, 0.7082749937728975, -0.7059366353972586, 42.68421052631579, 0.4436475543407839, -0.8962013431854703, 47.89473684210526, 0.13189217134206896, -0.9912640693269752, 53.10526315789473, -0.19387389817360803, -0.9810264581584788, 58.315789473684205, -0.49904506517542, -0.8665760341274508, 63.526315789473685, -0.7512035029540882, -0.6600706758745666, 68.73684210526315, -0.9235628390632815, -0.38344710495891227, 73.94736842105263, -0.9978136272187745, -0.06609058432569981, 79.1578947368421, -0.9660683293969043, 0.25828662941831565, 84.36842105263158, -0.8316991959112724, 0.5552264830864455, 89.57894736842105, -0.6089800368574013, 0.7931855487268777, 94.78947368421052, -0.3215699389503961, 0.9468858296349346, 100.0, -2.4492935982947064e-16, 1.0]),
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
