<script lang="ts">
  import { transfer, type Remote } from "comlink";
  import type { ChartiumController } from "./data-worker";
  import { mapOpt } from "../utils/mapOpt";
  import type { TraceList } from "./data-worker/trace-list";

  export let controller: ChartiumController | Remote<ChartiumController>;
  export let traces: TraceList;

  let canvas: HTMLCanvasElement | undefined;
  $: offscreen = canvas?.transferControlToOffscreen();
  $: renderer = mapOpt(offscreen, (c) => controller.createRenderer(transfer(c, [c])));

  $: renderer?.then((r) =>
    r.render({
      xType: "f32",
      traces,
      xRange: { from: 0, to: 100 },
      yRange: { from: -2, to: 2 },
    })
  );
</script>

<canvas bind:this={canvas} width="100" height="100" />
