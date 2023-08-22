<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { leftMouseDrag } from "../../utils/mouseGestures";
  import type { MouseDragCallbacks } from "../../utils/mouseGestures";
  import type { Range, Tick } from "../types";

  export const events = createEventDispatcher<{
    shift: { dx?: number; dy?: number };
  }>();

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  export let dragAction: "move" | "zoom" | "none" = "none";

  /** Coordinate of where dragging and ended for this axis */
  export let transformPosition: Range | undefined;
  /** Value of where dragging started and ended. Linearly interpolated from ticks */
  export let transformValue: Range | undefined;

  $: {
    // FIXME this should prolly be in chart and the axis should only return values for the positions
    if (
      dragAction === "move" &&
      transformPosition !== undefined &&
      transformPosition.from !== transformPosition.to
    ) {
      const delta =
        getAxisValueFromPosition(transformPosition.from) -
        getAxisValueFromPosition(transformPosition.to);
      const min = ticks[0].value;
      const max = (ticks.at(-1) ?? ticks[0]).value;
      transformValue = { from: min + delta, to: max + delta };
    }
  }

  /** linearly interpolates value from coordinate along this axis */
  function getAxisValueFromPosition(positionCoordinate: number) {
    const alongAxis =
      axis === "x"
        ? positionCoordinate / axisWidth
        : 1 - positionCoordinate / axisHeight;
    return (
      alongAxis * ((ticks.at(-1) ?? ticks[0]).value - ticks[0].value) +
      ticks[0].value
    );
    // TODO: this is linear interpolation. For more complicated graphs this has to be overhauled
  }

  const dragCallbacks: MouseDragCallbacks = {
    start: (e) => {
      const from = axis === "x" ? e.offsetX : e.offsetY;
      transformPosition = { from, to: from };
    },
    move: (e) => {
      dragAction = "move";
      transformPosition!.to = axis === "x" ? e.offsetX : e.offsetY;
    },
    end: (e) => {
      if (transformPosition && dragAction === "move") {
        const diff = transformPosition.to - transformPosition.from;
        const axisSize = axis === "x" ? axisWidth : -axisHeight;

        events("shift", {
          [`d${axis}`]: -diff / axisSize,
        });
      }

      dragAction = "none";
      transformPosition = undefined;
    },
  };

  let axisWidth: number = 1;
  let axisHeight: number = 1;
</script>

<div
  class="{axis} ticks-and-label"
  use:leftMouseDrag={dragCallbacks}
  bind:clientWidth={axisWidth}
  bind:clientHeight={axisHeight}
>
  <!-- tooltip -->
  {#if transformPosition !== undefined && transformPosition.from !== transformPosition.to}
    {@const prop = axis === "x" ? "left" : "top"}
    <div class="tooltip" style="{prop}={transformPosition.from}px">
      {transformValue?.from.toFixed(3)}
    </div>
    <div class="tooltip" style="{prop}={transformPosition.to}px">
      {transformValue?.to.toFixed(3)}
    </div>
  {/if}

  <div class="ticks">
    {#each ticks as tick}
      <span
        style={axis === "x"
          ? `left: ${(tick.position * 100).toFixed(2)}%`
          : `top: ${((1 - tick.position) * 100).toFixed(2)}%`}
      >
        {tick.value.toFixed(2)}
      </span>
    {/each}
  </div>
</div>

<style lang="scss">
  .ticks-and-label {
    align-items: stretch;
    position: relative;
  }

  .y {
    writing-mode: sideways-lr;
    width: 4rem;
    height: 100%;
  }

  .x {
    writing-mode: horizontal-tb;
    width: 100%;
    height: 1rem;
  }

  .ticks {
    position: relative;

    width: 100%;
    height: 100%;

    > span {
      position: absolute;
      line-height: 1;

      .x & {
        top: 0;
        transform: translateX(-50%);
      }

      .y & {
        right: 0;
        transform: translateY(-50%);
      }
    }
  }

  span,
  .tooltip,
  .ticks {
    user-select: none;
    pointer-events: none;
  }

  span {
    display: inline-block;
    text-align: center;
  }

  .tooltip {
    position: absolute;
  }
</style>
