<script lang="ts">
  import dayjs from "dayjs";
  import type { Point, Quantity } from "../types.js";
  import { qndFormat } from "../utils/format.js";
  import { portal } from "svelte-portal";

  /** position relative to body; i.e. absolute :d */
  export let position: Point;
  export let value: Quantity | number | dayjs.Dayjs;
  export let axis: "x" | "y";
  export let rotated: boolean = false;

  let clientHeight: number;
  let clientWidth: number;
  $: expectedLeft = position.x - (axis === "y" ? clientWidth + 4 : 0);
  $: overlapsRight = expectedLeft + clientWidth > window.innerWidth;
  $: overlapsLeft = expectedLeft < 0;
  $: style = `top: ${position.y + +(axis === "y") * 4}px; left: ${expectedLeft + (+overlapsLeft - +overlapsRight) * clientWidth}px; ${
    rotated
      ? axis === "y"
        ? `transform-origin: bottom right; transform: rotate(-90deg) translateX(${clientHeight}px)`
        : `transform-origin: top left; transform: rotate(-90deg) translateX(-${clientWidth}px);`
      : ""
  }`;
</script>

<div
  class="axis-bubble"
  class:x-axis-bubble={axis === "x"}
  class:y-axis-bubble={axis === "y"}
  {style}
  bind:clientHeight
  bind:clientWidth
  use:portal
>
  {qndFormat(value ?? 0, { decimals: 2, dateFormat: "YYYY-MM-DD\nHH:mm:ss" })}
</div>

<style lang="scss">
  .axis-bubble {
    position: absolute;
    pointer-events: none;
    user-select: none;

    background-color: var(--libchartium-secondary-background);
    border-radius: 4px;
    padding: 4px;
    font-size: 0.8rem;
    z-index: var(--libchartium-popup-z-index, 100);
    width: max-content;
    height: max-content;
    overflow: visible;
  }

  .x-axis-bubble {
    margin-top: 4px;
  }

  .y-axis-bubble {
    margin-right: 4px;
  }
</style>
