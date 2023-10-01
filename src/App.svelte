<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
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

  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  const Fa = Fa_1 as any as typeof Fa_2;

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
  const traces = controller
    .addFromArrayBuffer({
      ids: ["sin", "cos", "atan"],
      data: Float32Array.from(chartiumFriendlyTraceData),
      xType: "f32",
      yType: "f32",
    })
    .then((l) =>
      l
        .withDataUnits({
          x: SI.parseUnit("s"),
          y: IEC.parseUnit("KiB"),
        })
        .withStyle({
          "*": { width: 2 },
          sin: { color: "red" },
        })
    );

  let wrapDiv: HTMLElement;
  import domtoimage, { DomToImage } from "dom-to-image-more";
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
</script>

<main class="dark">
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <div style="height:600px;width:800px;" bind:this={wrapDiv}>
      <Chart
        {controller}
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
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
