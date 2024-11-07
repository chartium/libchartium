<script lang="ts">
  import {
    faArrowRight,
    faArrowLeft,
    faChartLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { IEC, SI } from "unitlib/systems";
  import {
    ChartComponent as Chart,
    NumericDateRepresentation,
    StatsTable,
    TraceList,
  } from "./lib/mod.js";

  import Fa from "svelte-fa";
  import { mut } from "@typek/signalhead";
  import { Quantity } from "unitlib";
  import Pie from "./lib/pie/pie.svelte";

  // autogenerate a lot of data
  const from = 0;
  const to = new Date(1973, 1, 1).getTime() / 1000;
  const numSteps = 5000;
  const stepSize = (to - from) / numSteps;

  const traceCount = 8;
  const normalTraces = (async () => {
    const results = [];

    for (let i = 0; i < 1; ++i) {
      const offset = traceCount * i;

      console.time("generate");

      const xs = Array.from(
        { length: numSteps },
        (_, index) => from + index * stepSize,
      );

      const ys = Array.from({ length: traceCount }, (_, idx) => ({
        id: `trace_${offset + idx}`,
        data: Float32Array.from(
          xs.map(
            (x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI + idx + offset),
          ),
        ),
      }));

      console.timeEnd("generate");

      console.time("load");

      const result = TraceList.fromColumns({
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
          "*": { "line-width": 2, fill: "to-next-in-stack", "stack-group": 0 },
          trace_2: {
            fill: "to-zero-y",
            line: "dashed",
            "line-dash-array": [10, 5],
          },
          trace_1: {
            line: "dashed",
            "line-dash-array": [5, 5],
            "tooltip-visibility": "hidden",
          },
          trace_3: { fill: "to-next-in-stack", "stack-group": 0 },
          trace_4: { fill: "to-next-in-stack", "stack-group": 0 },
          trace_5: {
            fill: "to-next-in-stack",
            "stack-group": 0,
            "line-width": 8,
          },
          sin: { color: "red" },
        },
      });
      console.timeEnd("load");

      results.push(result);
    }

    return results;
  })();
  const threshold = TraceList.fromThresholds({
    ids: ["threshold"],
    ys: new Float64Array([1000]),
    xDataUnit: NumericDateRepresentation.EpochSeconds(),
    yDataUnit: IEC.parseUnit("KiB"),
    tracelistsRange: { from: 0, to: 1 },
    style: {
      "*": { line: "dashed", "line-dash-array": [2, 5] },
    },
  });

  const traces = Promise.all([threshold, normalTraces]).then((ts) =>
    TraceList.union(
      ...ts.flatMap((list) => (Array.isArray(list) ? list : [list])),
    ),
  );

  let wrapDiv: HTMLDivElement;

  const table = StatsTable.mergeByVariant(
    StatsTable.fromSingleStat({
      statTitle: "Megabytes imagery",
      dataUnit: IEC.parseUnit("MiB"),
      values: [1000, 2000, 3000],
      ids: ["a", "b", "c"],
      displayUnit: IEC.parseUnit("GiB"),
    }),
    StatsTable.fromSingleStat({
      statTitle: "Centimeters of flesh",
      dataUnit: SI.parseUnit("cm"),
      values: [22, 33, 44],
      ids: ["d", "b", "c"],
      displayUnit: SI.parseUnit("m"),
    }),
    StatsTable.fromSingleStat({
      statTitle: "foo",
      dataUnit: SI.parseUnit("m"),
      values: [20, 8, 7, 6, 9, 9, 8, 8, 8, 7, 6, 5, 4, 3, 2, 1, 100],
      ids: [
        "_johnny",
        "alice",
        "bob",
        "cecil",
        "diana",
        "bobby",
        "brocoli",
        "mc grips",
        "zachary",
        "gec",
        "bar",
        "qux",
        "dog",
        "god",
        "hot",
        "xyzzy",
        "yes",
      ],
    }),
  );
</script>

<main>
  <div
    style:width="350px"
    style:height="250px"
    style:margin="auto"
    style:display="relative"
  >
    <Pie {table} statTitle="foo" />
  </div>

  <h1>Chartium test page</h1>
  {#await traces then traces}
    {@const commonXRange$ = mut(traces.range)}
    <div style="height:400px;width:900px;" bind:this={wrapDiv}>
      <Chart
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
        defaultYUnit={IEC.parseUnit("MiB")}
        legendPosition="bottom"
        hoverPointsInterpolation="nearest"
        {commonXRange$}
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
    <div style="height:400px;width:900px;" bind:this={wrapDiv}>
      <Chart
        {traces}
        title="Titulek"
        subtitle="Podtitulek"
        xLabel="Time"
        yLabel="Amount"
        defaultYUnit={IEC.parseUnit("MiB")}
        legendPosition="bottom"
        hoverPointsInterpolation="nearest"
        margins={{
          top: { value: new Quantity(0.3, IEC.parseUnit("MiB")) },
          left: { px: 10 },
          right: { percent: 10 },
        }}
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
