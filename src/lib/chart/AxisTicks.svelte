<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { leftMouseDrag } from "../../utils/mouseGestures";
  import type { MouseDragCallbacks } from "../../utils/mouseGestures";
  import type { Range, Tick } from "../types";

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  export let zoomOrMove: "zoom" | "move" | "neither" = "neither";

  /** Coordinate of where dragging and ended for this axis */
  export let transformPosition: Range | undefined;
  /** Value of where dragging started and ended. Linearly interpolated from ticks */
  export let transformValue: Range | undefined;
  /** Call Chart's change range */
  export let updateRange: () => void;

  $: {
    // FIXME this should prolly be in chart and the axis should only return values for the positions
    if (
      zoomOrMove === "move" &&
      transformPosition !== undefined &&
      transformPosition.from !== transformPosition.to
    ) {
      const delta =
        getAxisValueFromPosition(transformPosition.from) -
        getAxisValueFromPosition(transformPosition.to);
      const min = ticks[0].value;
      const max = (ticks.at(-1) ?? ticks[0]).value;
      transformValue = { from: min + delta, to: max + delta };
      zoomOrMove = "move";
    }
    if (
      zoomOrMove === "zoom" &&
      transformPosition !== undefined &&
      transformPosition.from !== transformPosition.to
    ) {
      const from = getAxisValueFromPosition(transformPosition.from);
      const to = getAxisValueFromPosition(transformPosition.to);
      transformValue = { from, to };
      zoomOrMove = "zoom";
    }
  }

  /** linearly interpolates value from coordinate along this axis */
  function getAxisValueFromPosition(positionCoordinate: number) {
    const alongAxis =
      axis === "x"
        ? positionCoordinate / 20 // axisWidth
        : 1 - positionCoordinate / 20; // axisHeight;
    return (
      alongAxis * ((ticks.at(-1) ?? ticks[0]).value - ticks[0].value) +
      ticks[0].value
    );
    // TODO: this is linear interpolation. For more complicated graphs this has to be overhauled
  }

  const dragCallbacks: MouseDragCallbacks = {
    start: (e) => {
      transformPosition =
        axis === "x"
          ? {
              from: e.offsetX,
              to: e.offsetX,
            }
          : { from: e.offsetY, to: e.offsetY };
    },
    move: (e) => {
      zoomOrMove = "move";
      transformPosition!.to = axis === "x" ? e.offsetX : e.offsetY;
    },
    end: (e) => {
      updateRange();
      zoomOrMove = "neither";
      transformPosition = undefined;
    },
  };
</script>

<div
  class="{axis} ticks-and-label"
  use:leftMouseDrag={dragCallbacks}
  style={axis === "y"
    ? "flex-direction: column-reverse"
    : "flex-direction: column"}
>
  <!-- tooltip -->
  {#if transformPosition !== undefined && transformPosition.from !== transformPosition.to}
    {#if axis === "x"}
      <div class="tooltip" style:left="{transformPosition.from}px">
        {transformValue?.from.toFixed(3)}
      </div>
      <div class="tooltip" style:left="{transformPosition.to}px">
        {transformValue?.to.toFixed(3)}
      </div>
    {:else}
      <div class="tooltip" style:top="{transformPosition.from}px">
        {transformValue?.from.toFixed(3)}
      </div>
      <div class="tooltip" style:top="{transformPosition.to}px">
        {transformValue?.to.toFixed(3)}
      </div>
    {/if}
  {/if}

  <div class="ticks">
    {#each ticks as tick}
      <span
        style={axis === "x"
          ? `left: ${(tick.position * 100).toFixed(2)}%`
          : `top: ${(tick.position * 100).toFixed(2)}%`}
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
    flex-direction: column-reverse;
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
    user-select: none;
    pointer-events: none;

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

  span {
    pointer-events: none;
    user-select: none;
    display: inline-block;
    text-align: center;
  }

  div {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tooltip {
    user-select: none;
    pointer-events: none;
    position: absolute;
  }
</style>
