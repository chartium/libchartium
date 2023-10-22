<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { MouseButtons, mouseDrag } from "../utils/mouseGestures.js";
  import {
    rightMouseClick,
    type MouseDragCallbacks,
  } from "../utils/mouseGestures.js";
  import type { Point, Range, Shift, Tick, Unit } from "../types.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";
  import { observeResize } from "../utils/actions.js";
  import {
    type ContextItem,
    GenericContextMenu,
  } from "../contextMenu/index.js";
  import {
    ZippedSignal,
    type Signal,
    type WritableSignal,
    mut,
  } from "@mod.js/signals";
  import { zip } from "../utils/collection.js";

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

  // flatten the mutable prop containing a store into a store
  const raiseFactor$ = mut($raiseFactor);
  $: raiseFactor$.set($raiseFactor);
  const lowerFactor$ = mut($lowerFactor);
  $: lowerFactor$.set($lowerFactor);

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
    raiseFactor$.map(($v) => {
      if (!$v) return;
      const { unit, callback } = $v;
      return <const>{
        type: "leaf",
        content: `Raise unit to ${unit.toString()}`,
        callback() {
          callback();
          menu.close();
        },
      };
    }),
    lowerFactor$.map(($v) => {
      if (!$v) return;
      const { unit, callback } = $v;
      return <const>{
        type: "leaf",
        content: `Lower unit to ${unit.toString()}`,
        callback() {
          callback();
          menu.close();
        },
      };
    })
  ).map((arr) => arr.filter((x) => x) as ContextItem<string>[]);

  let menu: { open(p: Point): void; close(): void };
</script>

<GenericContextMenu items={$contextItems} bind:this={menu} />

<div
  class="ticks-container"
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
    <div
      class="{axis} ticks"
      style="{axis === `x` ? `height` : `width`}: {ticks.some(
        (tick) => tick.subvalue !== undefined
      )
        ? `2.5em`
        : `1.5em`}"
    >
      {#each ticks as tick}
        <span
          style={axis === "x"
            ? `left: ${(tick.position * 100).toFixed(2)}%`
            : `top: ${((1 - tick.position) * 100).toFixed(2)}%`}
        >
          {tick.value}
          {#if tick.subvalue}
            <br />
            {tick.subvalue}
          {/if}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .y {
    writing-mode: sideways-lr;
    height: 100%;
  }

  .x {
    writing-mode: horizontal-tb;
    width: 100%;
  }

  .ticks {
    position: relative;
  }
  .x.ticks > span {
    position: absolute;
    line-height: 1;
    width: max-content;
    display: flex;
    flex-direction: column;
    transform: translateX(-50%);
  }

  .y.ticks > span {
    position: absolute;
    line-height: 1;
    width: max-content;
    display: flex;
    flex-direction: column;
    transform: translateY(-50%);
  }

  .ticks.x {
    padding-top: 4px;
  }
  .ticks.y {
    padding-left: 4px;
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
