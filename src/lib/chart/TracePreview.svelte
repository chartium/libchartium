<!-- component for showing a bit of the trace for legends and tooltips and such -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { TraceInfo } from "../data-worker/trace-list.js";
  import * as canvas from "./canvas.js";

  export let previewedTrace: TraceInfo;

  let canvasRef: HTMLCanvasElement;
  export let previewWidth: number = 20;
  export let previewHeight: number = 20;

  /** If true, will just show color of trace, otherwise also width */
  export let simplified: boolean = false;
  let ctx: CanvasRenderingContext2D | null = null;

  onMount(() => {
    ctx = canvasRef.getContext("2d");
    drawPreview(previewedTrace, previewHeight, previewWidth);
  });

  $: drawPreview(previewedTrace, previewHeight, previewWidth);

  function drawPreview(trace: TraceInfo, height: number, width: number) {
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    const color = trace.color;
    const traceWidth = trace.width;
    const points = trace.display === "points" ? true : false;
    const style: canvas.DrawStyle = {
      fillStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
      strokeStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
    };

    if (simplified) {
      style.lineWidth = 7;
      canvas.drawSegment(ctx, [width / 2, height], [width / 2, 0], style);
      return;
    }

    style.lineWidth = traceWidth;

    if (points) {
      canvas.drawCircle(
        ctx,
        [width - traceWidth, traceWidth],
        traceWidth,
        style
      );
      canvas.drawCircle(ctx, [previewWidth / 2, height / 2], traceWidth, style);
      canvas.drawCircle(
        ctx,
        [traceWidth, height - traceWidth],
        traceWidth,
        style
      );
    } else {
      canvas.drawSegment(ctx, [0, height], [width, 0], style);
    }
  }
</script>

<div>
  <canvas bind:this={canvasRef} height={previewWidth} width={previewHeight} />
</div>
