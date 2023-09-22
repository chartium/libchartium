<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { MouseButtons, mouseDrag } from "../../utils/mouseGestures";
  import {
    rightMouseClick,
    type MouseDragCallbacks,
  } from "../../utils/mouseGestures";
  import type { Point, Range, Shift, Tick, Unit } from "../types";
  import type { VisibleAction } from "./ActionsOverlay.svelte";
  import { observeResize } from "../../utils/actions";
  import { type ContextItem, GenericContextMenu } from "../contextMenu";
  import {
    ZippedSignal,
    type Signal,
    type WritableSignal,
  } from "@mod.js/signals";

  export const events = createEventDispatcher<{
    shift: Shift;
  }>();

  export let hideTicks: boolean;

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  export let disableInteractivity: boolean;

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  type UnitAction = Signal<{ unit: Unit; callback: () => void } | undefined>;
  export let raiseFactor: UnitAction;
  export let lowerFactor: UnitAction;

  const dragCallbacks: MouseDragCallbacks = {
    start: (e) => {},
    move: (_, status) => {
      if (disableInteractivity) return;
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
      if (disableInteractivity) return;
      const shift = status.relativeShift;

      if (axis === "x") delete shift.dy;
      if (axis === "y") delete shift.dx;

      events("shift", shift);
      visibleAction.set(undefined);
    },
  };

  let axisWidth: number = 1;
  let axisHeight: number = 1;

  const contextItems = ZippedSignal(
    raiseFactor.map(($v) => {
      if (!$v) return;
      const { unit, callback } = $v;
      return <const>{
        type: "leaf",
        content: `Raise unit to ${unit.toString()}`,
        callback,
      };
    }),
    lowerFactor.map(($v) => {
      if (!$v) return;
      const { unit, callback } = $v;
      return <const>{
        type: "leaf",
        content: `Lower unit to ${unit.toString()}`,
        callback,
      };
    })
  ).map((arr) => arr.filter((x) => x) as ContextItem<string>[]);

  let menu: { open(p: Point): void };
</script>

<GenericContextMenu items={$contextItems} bind:this={menu} />

<div
  class="{axis} ticks-and-label"
  use:mouseDrag={{
    ...dragCallbacks,
    button: MouseButtons.Left,
  }}
  use:observeResize={([width, height]) => {
    axisWidth = width;
    axisHeight = height;
  }}
  role="presentation"
  on:contextmenu|preventDefault
  use:rightMouseClick={(e) => menu.open(e)}
>
  {#if !hideTicks}
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
  {/if}
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
