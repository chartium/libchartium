<script lang="ts">
  import { onMount } from "svelte";

  import type { TraceList } from "../data-worker/trace-list";
  import * as canvas from "./canvas";

  export let numberOfShownTraces: number = 5;

  export let traces: TraceList;
  $: tracesWithStyles = Array.from(traces.tracesWithStyles()); // FIXME replace with first(traces, n)

  let canvasRefs: HTMLCanvasElement[] = [];
  $: console.log("tracesWithStyles", tracesWithStyles);
  onMount(() => {
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
        canvas.drawCircle(ctx, [previewSize-width, width], width, style);
        canvas.drawCircle(
          ctx,
          [previewSize / 2, previewSize / 2],
          width,
          style
        );
        canvas.drawCircle(ctx, [width, previewSize-width], width, style);
      } else {
        canvas.drawSegment(ctx, [0, previewSize], [previewSize, 0], style);
      }
    }
  });

  /** Width and height of the lil preview window */
  const previewSize = 20;
</script>

<div class="legend-container">
  {#each tracesWithStyles as styledTrace, index}
    <div class="trace-legend">
      <div class="trace-preview">
        <canvas
          bind:this={canvasRefs[index]}
          width={previewSize}
          height={previewSize}
        />
      </div>
      {styledTrace.id}
    </div>
  {/each}
</div>

<style>
  .legend-container {
    display: flex;
    flex-direction: row;
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

  @media (max-width: 300px) {
    .legend-container {
      flex-direction: column;
    }
  }
</style>
