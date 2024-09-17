<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Tick } from "../types.js";
  import { guidelines$ } from "../state/guidelines/guidelines.js";
  import { mut } from "@typek/signalhead";
  import type { ChartStyleSheet } from "../state/core/style.js";

  export let chartStylesheet: Partial<ChartStyleSheet>;
  export const chartStylesheet$ = mut(chartStylesheet);
  $: chartStylesheet$.set(chartStylesheet);

  export let xTicks: Tick[];
  const xTicks$ = mut(xTicks);
  $: xTicks$.set(xTicks);

  export let yTicks: Tick[];
  const yTicks$ = mut(yTicks);
  $: yTicks$.set(yTicks);

  let canvas: HTMLCanvasElement | undefined;
  const canvas$ = mut(canvas);
  $: canvas$.set(canvas);

  guidelines$({
    guidelinesCanvas$: canvas$,
    chartStylesheet$,
    xTicks$,
    yTicks$,
    defer: onDestroy,
  });
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    pointer-events: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
