<script lang="ts">
  import { transfer, type Remote } from "comlink";
  import type { ChartiumController } from "./data-worker";
  import { mapOpt } from "../utils/mapOpt";

  export let controller: Remote<ChartiumController>;
  export let traces: TraceList;

  let canvas: HTMLCanvasElement | undefined;
  $: offscreen = canvas?.transferControlToOffscreen();
  $: renderer = mapOpt(offscreen, (c) => controller.createRenderer(transfer(c, [c])));

  $: console.log(controller);
  $: renderer?.then((r) =>
    r.render({
      xType: "f32",
      includeTraces: traces,
      xRange: { from: 0, to: 100 },
      yRange: { from: -2, to: 2 },
    })
  );
</script>

<canvas bind:this={canvas} width="100" height="100" />
