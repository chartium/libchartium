<script lang="ts">
  import dayjs from "dayjs";
  import type { Point, Quantity } from "../types.js";
  import { qndFormat } from "../utils/format.js";

  /** *relative* position at the edge of the canvas */
  export let position: Point;
  export let value: Quantity | number | dayjs.Dayjs;
  export let axis: "x" | "y";

  let clientHeight: number;
  let clientWidth: number;

  $: style =
    axis === "x"
      ? `top: ${position.y}px; left: ${position.x}px`
      : `top: ${position.y}px; right: ${position.x}px; transform: rotate(-90deg) translateY(-${clientHeight}px)`;
</script>

<div
  class="axis-bubble"
  class:x-axis-bubble={axis === "x"}
  class:y-axis-bubble={axis === "y"}
  {style}
  bind:clientHeight
  bind:clientWidth
>
  {qndFormat(value ?? 0, { decimals: 2, dayjsFormat: "YYYY-MM-DD\nHH:mm:ss" })}
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
    z-index: 1;
    overflow: hidden;
    width: max-content;
    height: max-content;
  }

  .x-axis-bubble {
    margin-top: 4px;
  }

  .y-axis-bubble {
    transform-origin: top right;
    transform: rotate(-90deg);
    margin-right: 4px;
  }
</style>
