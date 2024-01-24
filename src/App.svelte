<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
  import wasmUrl from "../dist/wasm/libchartium.wasm?url";
  import ToolbarButton from "./lib/chart/ToolbarButton.svelte";
  import { ChartiumController } from "./lib/data-worker/index.js";
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
  import domToImage, { DomToImage } from "dom-to-image-more";
  import { NumericDateFormat } from "./lib/index.js";
  import { Quantity } from "unitlib";

  import Fa from "svelte-fa";

  // autogenerate a lot of data
  const from = 0;
  const to = 6000;
  const numSteps = to;
  const stepSize = (to - from) / numSteps;

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize,
  );

  const ys = Array.from({ length: 100 }, (_, idx) => ({
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

  let wrapDiv: HTMLElement;
  const dti: DomToImage = domToImage as any;

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
    <div style="height:500px;width:900px;" bind:this={wrapDiv}>
      <Chart
        {controller}
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
        defaultYUnit={IEC.parseUnit("MiB")}
        legendPosition="right"
        legendTracesShown={10}
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
