<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
  import wasmUrl from "../dist/wasm/libchartium.wasm?url";
  import ToolFullscreen from "./lib/ToolFullscreen.svelte";
  import ToolExportToPng from "./lib/chart/Toolbar/ToolExportToPNG.svelte";
  import ToolHideLegend from "./lib/chart/Toolbar/ToolHideLegend.svelte";
  import { portal } from "svelte-portal";
  import { ChartiumController } from "./lib/data-worker/index.js";
  import {
    faArrowRight,
    faArrowLeft,
    faChartLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { SI, IEC } from "unitlib/systems";
  import { NumericDateFormat } from "./lib/index.js";
  import { Quantity } from "unitlib";

  import Fa from "svelte-fa";
  import ToolExportToCsv from "./lib/chart/Toolbar/ToolExportToCSV.svelte";

  // autogenerate a lot of data
  const from = 0;
  const to = 6000;
  const numSteps = to;
  const stepSize = (to - from) / numSteps;

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize,
  );

  const ys = Array.from({ length: 2 }, (_, idx) => ({
    id: `trace_${idx}`,
    data: Float32Array.from(
      xs.map((x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI + idx)),
    ),
  }));

  const controller = ChartiumController.instantiateInThisThread({ wasmUrl });

  const traces = controller.addFromColumnarArrayBuffers({
    x: {
      type: "f32",
      unit: NumericDateFormat.EpochSeconds,
      data: Float32Array.from(xs),
    },
    y: {
      type: "f32",
      unit: IEC.parseUnit("KiB"),
      columns: ys,
    },
    style: {
      "*": { width: 2 },
      sin: { color: "red" },
    },
  });

  let wrapDiv: HTMLDivElement;

  let fullscreen = false;
</script>

<main class="dark">
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <div style="height:400px;width:900px;" bind:this={wrapDiv}>
      <div
        use:portal={fullscreen ? "body" : wrapDiv}
        class:fullscreen
        style={"height: 100%; width: 100%;"}
      >
        <Chart
          {controller}
          {traces}
          title="Titulek"
          subtitle="Podtitulek"
          xLabel="Time"
          yLabel="Amount"
          defaultYUnit={IEC.parseUnit("MiB")}
          legendPosition="right"
        >
          <!-- <svelte:fragment slot="toolbar">
            <ToolFullscreen on:click={() => (fullscreen = !fullscreen)} />
            <ToolExportToPng />
            <ToolHideLegend />
            <ToolExportToCsv />
          </svelte:fragment> -->
          <svelte:fragment slot="infobox">
            <Fa icon={faArrowRight} />&ensp;1<br />
            <Fa icon={faArrowLeft} />&ensp;1000<br />
            <Fa icon={faChartLine} />&ensp;3/3
          </svelte:fragment>
        </Chart>
      </div>
    </div>
  {/await}
</main>

<style>
  .fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }
</style>
