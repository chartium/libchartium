<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { MouseButtons, mouseDrag } from "../../utils/mouseGestures";
  import type { MouseDragCallbacks } from "../../utils/mouseGestures";
  import type { Range, Shift, Tick } from "../types";
  import type { Writable } from "svelte/store";
  import type { VisibleAction } from "./ChartOverlay.svelte";

  export const events = createEventDispatcher<{
    shift: Shift;
  }>();

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  /** Coordinate of where dragging and ended for this axis */
  // export let transformPosition: Range | undefined;
  /** Value of where dragging started and ended. Linearly interpolated from ticks */
  // export let transformValue: Range | undefined;

  export let visibleAction: Writable<VisibleAction | undefined>;

  const dragCallbacks: MouseDragCallbacks = {
    start: (e) => {},
    move: (_, status) => {
      const shift = status.relativeShift;

      if (axis === "x") {
        shift.origin.y = 0.5;
        delete shift.dy;
      }
      if (axis === "y") {
        shift.origin.x = 0.5;
        delete shift.dx;
      }

      visibleAction.set({ shift });
    },
    end: (_, status) => {
      const shift = status.relativeShift;

      if (axis === "x") delete shift.dy;
      if (axis === "y") delete shift.dx;

      events("shift", shift);
      visibleAction.set(undefined);
    },
  };

  let axisWidth: number = 1;
  let axisHeight: number = 1;
</script>

<div
  class="{axis} ticks-and-label"
  use:mouseDrag={{
    ...dragCallbacks,
    button: MouseButtons.Left,
  }}
  bind:clientWidth={axisWidth}
  bind:clientHeight={axisHeight}
>
  <!-- tooltip -->
  <!-- {#if transformPosition !== undefined && transformPosition.from !== transformPosition.to}
    {@const prop = axis === "x" ? "left" : "top"}
    <div class="tooltip" style="{prop}={transformPosition.from}px">
      {transformValue?.from.toFixed(3)}
    </div>
    <div class="tooltip" style="{prop}={transformPosition.to}px">
      {transformValue?.to.toFixed(3)}
    </div>
  {/if} -->

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
