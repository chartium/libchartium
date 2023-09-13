<script lang="ts">
  import { onMount } from "svelte";

  import type { TraceList } from "../data-worker/trace-list";
  import * as canvas from "./canvas";
  import TracePreview from "./TracePreview.svelte";
  import { map } from "../../utils/collection";

  export let numberOfShownTraces: number = 5;

  export let previewType: "simplified" | "full";

  export let traces: TraceList;
  $: tracesWithStyles = Array.from(
    map(traces.traces(), (t) => traces.getTraceInfo(t)) // FIXME replace with first(traces, n)
  );

  let canvasRefs: HTMLCanvasElement[] = [];

  let container: HTMLElement; // FIXME this is a lame workaround for the @container css query which for some reason (??) doesn't work in svelte altho the github issue says it is closed
  let wide = false;

  onMount(() => {
    if (container.clientWidth > 300) {
      // FIXME delet when @container
      wide = true;
    }

    for (const [index, canvasRef] of canvasRefs.entries()) {
      const color = tracesWithStyles[index].color;
      const width = tracesWithStyles[index].width;
      const points =
        tracesWithStyles[index].display === "points" ? true : false;

      const ctx = canvasRef.getContext("2d");
      if (!ctx) {
        continue;
      }

      const style: canvas.DrawStyle = {
        fillStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
        strokeStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
        lineWidth: width,
      };

      if (points) {
        canvas.drawCircle(ctx, [previewSize - width, width], width, style);
        canvas.drawCircle(
          ctx,
          [previewSize / 2, previewSize / 2],
          width,
          style
        );
        canvas.drawCircle(ctx, [width, previewSize - width], width, style);
      } else {
        canvas.drawSegment(ctx, [0, previewSize], [previewSize, 0], style);
      }
    }
  });

  /** Width and height of the lil preview window */
  const previewSize = 20;
</script>

<div
  class="legend-container"
  bind:this={container}
  style:flex-direction={wide ? "row" : "column"}
>
  <!--
  {#each {length: numberOfShownTraces} as _, i} <!-- a lil trick ti break after numberOfShownTraces - ->
  {@const styledTrace = tracesWithStyles[i]}
-->
  {#each tracesWithStyles.slice(0, numberOfShownTraces) as styledTrace}
    <div class="trace-legend">
      <div class="trace-preview">
        <TracePreview
          previewedTrace={styledTrace}
          previewHeight={previewSize}
          previewWidth={previewSize}
          simplified={previewType === "simplified"}
        />
      </div>
      {styledTrace.id}
    </div>
  {/each}
</div>

<style>
  .legend-container {
    display: flex;
    justify-content: space-between;
    margin: 0.5rem;
  }

  .trace-preview {
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  .trace-legend {
    display: flex;
    flex-direction: row;
    align-items: start;
  }
</style>
