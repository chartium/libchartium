<script lang="ts">
  import Chart from "./lib/components/Chart.svelte";
  import wasmUrl from "../dist/wasm/libchartium.wasm?url";

  import { ChartiumController } from "./lib/data-worker/index.js";
  import {
    faArrowRight,
    faArrowLeft,
    faChartLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { IEC } from "unitlib/systems";
  import { NumericDateRepresentation, TraceList } from "./lib/index.js";

  import Fa from "svelte-fa";

  // autogenerate a lot of data
  const from = 0;
  const to = new Date(1973, 1, 1).getTime() / 1000;
  const numSteps = 5000;
  // const to = 5000;
  // const numSteps = to;
  const stepSize = (to - from) / numSteps;

  const controller = ChartiumController.instantiateInThisThread({ wasmUrl });

  const normalTraces = (async () => {
    console.time("generate");

    const xs = Array.from(
      { length: numSteps },
      (_, index) => from + index * stepSize,
    );

    const ys = Array.from({ length: 500 }, (_, idx) => ({
      id: `trace_${idx}`,
      data: Float32Array.from(
        xs.map((x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI + idx)),
      ),
    }));

    console.timeEnd("generate");

    console.time("load");

    const result = await controller.addFromColumnarArrayBuffers({
      x: {
        type: "f32",
        unit: NumericDateRepresentation.EpochSeconds(),
        data: Float32Array.from(xs),
      },
      y: {
        type: "f32",
        unit: IEC.parseUnit("KiB"),
        columns: ys,
      },
      style: {
        "*": { "line-width": 2 },
        sin: { color: "red" },
      },
    });

    console.timeEnd("load");

    return result;
  })();
  const threshold = controller.addThresholdTracelist({
    ids: ["threshold"],
    ys: new Float64Array([100]),
    xDataUnit: NumericDateRepresentation.EpochSeconds(),
    yDataUnit: IEC.parseUnit("KiB"),
    tracelistsRange: { from: 0, to: 1 },
    style: {
      "*": {
        line: "dashed",
      },
    },
  });

  const traces = Promise.all([threshold, normalTraces]).then((ts) =>
    TraceList.union(...ts),
  );

  let wrapDiv: HTMLDivElement;
</script>

<main class="dark">
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <div style="height:400px;width:900px;" bind:this={wrapDiv}>
      <Chart
        {controller}
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
        defaultYUnit={IEC.parseUnit("MiB")}
        legendPosition="bottom"
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
  {/await}
</main>
