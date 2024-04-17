<!-- component for showing a bit of the trace for legends and tooltips and such -->
<script lang="ts">
  import type { ComputedTraceStyle } from "../data-worker/trace-list.js";
  import * as canvas from "./canvas.js";

  export let traceStyle: ComputedTraceStyle;

  export let previewWidth: number = 20;
  export let previewHeight: number = 20;

  /** If true, will just show color of trace, otherwise also width */
  export let simplified: boolean = false;

  let canvasRef: HTMLCanvasElement | undefined;
  $: ctx = canvasRef?.getContext("2d") ?? undefined;
  $: drawPreview({
    ctx,
    color: traceStyle.color,
    width: traceStyle["line-width"],
    showPoints: traceStyle.points === "show",
    previewHeight,
    previewWidth,
  });

  function drawPreview({
    ctx,
    color,
    width,
    showPoints,
    previewHeight,
    previewWidth,
  }: {
    ctx: CanvasRenderingContext2D | undefined;
    width: number;
    showPoints: boolean;
    color: string;
    previewHeight: number;
    previewWidth: number;
  }) {
    if (!ctx) return;

    ctx.clearRect(0, 0, previewWidth, previewHeight);
    const style: canvas.DrawStyle = { fillStyle: color, strokeStyle: color };
    style.lineWidth = width;

    if (showPoints) {
      canvas.drawCircle(ctx, [previewWidth - width, width], width, style);
      canvas.drawCircle(
        ctx,
        [previewWidth / 2, previewHeight / 2],
        width,
        style,
      );
      canvas.drawCircle(ctx, [width, previewHeight - width], width, style);
    } else {
      canvas.drawSegment(ctx, [0, previewHeight], [previewWidth, 0], style);
    }
  }
</script>

<div class="trace-preview" class:simplified>
  {#if simplified}
    <div class="color-indicator" style="background: {traceStyle.color}" />
  {:else}
    <canvas bind:this={canvasRef} height={previewWidth} width={previewHeight} />
  {/if}
</div>

<style lang="scss">
  .trace-preview {
    margin: 0 0.5rem;
    &.simplified {
      margin: 0 0.1rem 0 0.5rem;
    }
  }

  .color-indicator {
    height: 20px;
    padding: 0;
    width: 5px;
    min-width: 0.3rem;
    margin: 0 0.2rem 0 -0.2rem;

    // &.highlight {
    //   min-width: round_to_px(0.5rem);
    // }
  }
</style>
