<!-- component for showing a bit of the trace for legends and tooltips and such -->
<script lang="ts">
  import type { ComputedTraceStyle } from "../data-worker/trace-list.js";
  import * as canvas from "./canvas.js";

  export let traceStyle: ComputedTraceStyle;

  export let previewWidth: number = 20;
  export let previewHeight: number = 20;

  /** If true, will just show color of trace, otherwise also width */
  export let simplified: boolean = false;

  const segments = (
    style:
      | { dashed: [number, number] }
      | { "double-dashed": [number, number, number, number] },
  ) => {
    const SMALL = 3;
    const BIG = 6;
    const biggestDash =
      "dashed" in style
        ? style.dashed[0]
        : Math.max(...style["double-dashed"].filter((_, i) => i % 2 === 0));
    if (biggestDash > BIG) return ["why do the", "call it"];
    if (biggestDash > SMALL) return ["oven", "of in the", "cold food"];
    return ["of out", "hot", "eat the food", "huh?"];
  };

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
    {#if traceStyle.line === "solid"}
      <div class="color-indicator" style="background: {traceStyle.color}" />
    {:else if traceStyle.line !== "none"}
      <div class="color-indicator">
        {#each segments(traceStyle.line) as _}
          <div style="background: {traceStyle.color}" />
        {/each}
      </div>
    {/if}
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
    display: flex;
    flex-direction: column;
    gap: 4px;
    > div {
      height: 100%;
      flex-shrink: 1;
    }

    // &.highlight {
    //   min-width: round_to_px(0.5rem);
    // }
  }
</style>
