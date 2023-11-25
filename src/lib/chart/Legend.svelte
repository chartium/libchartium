<script lang="ts">
  import { onMount } from "svelte";

  import type { TraceList } from "../data-worker/trace-list.js";
  import * as canvas from "./canvas.js";
  import TracePreview from "./TracePreview.svelte";
  import { map } from "../utils/collection.js";

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
      <div
        class="trace-preview"
        class:simplified={previewType === "simplified"}
      >
        <TracePreview
          previewedTrace={styledTrace}
          previewHeight={previewSize}
          previewWidth={previewSize}
          simplified={previewType === "simplified"}
        />
      </div>
      {styledTrace.label ?? styledTrace.id}
    </div>
  {/each}
</div>

<style lang="scss">
  .legend-container {
    display: flex;
    justify-content: start;
    flex-wrap: wrap;
    margin: 0.5rem;

    .trace-preview {
      margin: 0 0.5rem;
      &.simplified {
        margin: 0 0.1rem 0 0.5rem;
      }
    }

    .trace-legend {
      display: flex;
      flex: 1;
      flex-direction: row;
      align-items: start;
      text-wrap: nowrap;
    }
  }
</style>
