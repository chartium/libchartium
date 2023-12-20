<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
  import wasmUrl from "../dist/wasm/libchartium.wasm?url";
  import ToolbarButton from "./lib/chart/ToolbarButton.svelte";
  import { ChartiumController, TraceList } from "./lib/data-worker/index.js";
  import {
    faArrowRight,
    faArrowLeft,
    faChartLine,
    faExpand,
    faCamera,
    faDownload,
    faUpDown,
    faUserClock,
  } from "@fortawesome/free-solid-svg-icons";
  import { SI, IEC } from "unitlib/systems";

  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  const Fa = Fa_1 as any as typeof Fa_2;

  // autogenerate a lot of data
  const from = 0;
  const to = 6000;
  const numSteps = to;
  const stepSize = (to - from) / numSteps;

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize
  );
  const y1s = xs.map((x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI));
  const y2s = xs.map((x) => 100 + 100 * Math.cos((x / to) * 2 * Math.PI));
  const y3s = xs.map((x) => 75 + 75 * Math.tanh((x / to - 0.5) * 2 * Math.PI));
  const chartiumFriendlyTraceData = xs.flatMap((x, index) => [
    x,
    y1s[index],
    y2s[index],
    y3s[index],
  ]);

  const secondTraces = xs.flatMap((x, index) => [x, y1s[index] * -1 + 100]);

  // const controller = spawnChartiumWorker();
  const controller = ChartiumController.instantiateInThisThread({ wasmUrl });

  const traces = controller.addFromArrayBuffer({
    ids: ["sin", "cos", "atan"],
    data: Float32Array.from(chartiumFriendlyTraceData),
    xType: "f32",
    yType: "f32",
    xUnit: NumericDateFormat.EpochSeconds,
    yUnit: IEC.parseUnit("KiB"),
    style: {
      "*": { width: 2 },
      sin: { color: "red" },
    },
  });

  let wrapDiv: HTMLElement;
  import domtoimage, { DomToImage } from "dom-to-image-more";
  import { NumericDateFormat } from "./lib/index.js";
  import { Quantity } from "unitlib";
  const dti: DomToImage = domtoimage as any;

  const takeScreenshot = () => {
    dti.toPng(wrapDiv).then((url) => {
      const link = document.createElement("a");
      link.download = `graph.png`;
      link.href = url;
      link.click();
    });
  };

  (window as any).SI = SI;
  (window as any).IEC = IEC;
  (window as any).Quantity = Quantity;
</script>

<main class="dark">
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <div style="height:150px;width:900px;" bind:this={wrapDiv}>
      <Chart
        {controller}
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
        yUnit={IEC.parseUnit("MiB")}
        legendPosition="right"
      >
        <svelte:fragment slot="toolbar">
          <ToolbarButton title="Fullscreen">
            <Fa icon={faExpand} />
          </ToolbarButton>
          <ToolbarButton on:click={takeScreenshot} title="Screenshot">
            <Fa icon={faCamera} />
          </ToolbarButton>
          <ToolbarButton title="Download png">
            <Fa icon={faDownload} />
          </ToolbarButton>
          <ToolbarButton title="Autoscale Y axis">
            <Fa icon={faUpDown} />
          </ToolbarButton>
          <ToolbarButton title="Change timezones">
            <Fa icon={faUserClock} />
          </ToolbarButton>
        </svelte:fragment>

        <svelte:fragment slot="infobox">
          <Fa icon={faArrowRight} />&ensp;1<br />
          <Fa icon={faArrowLeft} />&ensp;1000<br />
          <Fa icon={faChartLine} />&ensp;3/3
        </svelte:fragment>
      </Chart>
    </div>
  {/await}
</main>
