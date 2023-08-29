<script lang="ts">
  import Chart from "./lib/chart/Chart.svelte";
  import ToolbarButton from "./lib/chart/ToolbarButton.svelte";
  import { ChartiumController } from "./lib/data-worker";
  import Fa from 'svelte-fa';
  import { faArrowRight, faArrowLeft, faChartLine, faExpand, faCamera, faDownload, faUpDown, faUserClock } from '@fortawesome/free-solid-svg-icons'

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
  const traces = controller.addFromArrayBuffer({
    ids: ["sin", "cos", "atan"],
    data: Float32Array.from(chartiumFriendlyTraceData),
    xType: "f32",
    yType: "f32",
  });

  // FIXME for debugging only
  traces.then((traces) => {
    for (const trace of traces.tracesWithStyles()) console.log(trace);
  });
</script>

<main class="dark">
  <h1>Chartium test page</h1>
  {#await traces then traces}
    <div style="height:600px;width:800px;">
      <Chart
        {controller}
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Number of zines published"
        yLabel="Prefiguration achieved [megatons]"
      >
        <svelte:fragment slot="toolbar">
          <ToolbarButton>
            <Fa icon={faExpand} />
          </ToolbarButton>
          <ToolbarButton>
            <Fa icon={faCamera} />
          </ToolbarButton>
          <ToolbarButton>
            <Fa icon={faDownload} />
          </ToolbarButton>
          <ToolbarButton>
            <Fa icon={faUpDown} />
          </ToolbarButton>
          <ToolbarButton>
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
