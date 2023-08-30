<script lang="ts">
  import { onMount } from "svelte";
  import { scaleCanvas } from "../../utils/actions";
  import type { Tick } from "../types";

  export let xTicks: Tick[];
  export let yTicks: Tick[];

  export let renderTicks = true;
  export let renderAxes = true;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let canvasSize: [number, number] = [1, 1];

  onMount(() => {
    ctx = canvas.getContext("2d")!;
  });

  $: if (ctx) {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvasSize[0], canvasSize[1]);

    if (renderAxes) {
      const color = "rgb(76,76,76)";
      const width = 2;

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;

      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, canvasSize[1] - width / 2);
      ctx.lineTo(canvasSize[0], canvasSize[1] - width / 2);
      ctx.stroke();
    }

    if (renderTicks) {
      const color = getComputedStyle(canvas).color;

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;

      for (const tick of xTicks) {
        const position = Math.trunc(tick.position * canvasSize[0]);

        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, canvasSize[1]);
        ctx.stroke();
      }

      for (const tick of yTicks) {
        const position = Math.trunc((1 - tick.position) * canvasSize[1]);

        ctx.beginPath();
        ctx.moveTo(0, position);
        ctx.lineTo(canvasSize[0], position);
        ctx.stroke();
      }
    }
  }
</script>

<canvas bind:this={canvas} use:scaleCanvas={(size) => (canvasSize = size)} />

<style>
  canvas {
    pointer-events: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    color: rgb(217, 217, 217);
  }

  :global(.dark) canvas {
    color: rgb(76, 76, 76);
  }
</style>
