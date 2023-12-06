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
  let style: string;
  $: {
    const pointerAndPosition = `pointer-events: none; position: absolute; top: ${position.y}px;`;
    const axisPosition = `${axis === "x" ? "left" : "right"}: ${position.x}px;`;
    const writingMode =
      axis === "x"
        ? ""
        : `transform-origin: top right; transform: rotate(-90deg) translateY(-${clientHeight}px);`;
    const margin = axis === "x" ? "margin-top: 4px;" : "margin-right: 4px;";

    style = `${pointerAndPosition} ${axisPosition} ${writingMode} ${margin}`;
  }
</script>

<div {style} bind:clientHeight bind:clientWidth>
  {qndFormat(value ?? 0, { decimals: 2, dayjsFormat: "YYYY-MM-DD\nHH:mm:ss" })}
</div>

<style>
  div {
    background-color: var(--secondary-background);
    border-radius: 4px;
    padding: 4px;
    font-size: 0.8rem;
    z-index: 1;
    overflow: hidden;
    width: max-content;
    height: max-content;
  }
</style>
