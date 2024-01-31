<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { MouseButtons, mouseDrag } from "../utils/mouseActions.js";
  import {
    mouseClick,
    type MouseDragCallbacks,
  } from "../utils/mouseActions.js";
  import type { Point, Shift, Tick, Unit } from "../types.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";
  import {
    type ContextItem,
    GenericContextMenu,
  } from "../contextMenu/index.js";
  import { mut, Signal, WritableSignal, ZippedSignal } from "@mod.js/signals";
  import { measureText } from "../utils/format.js";
  import RotatedBox from "../utils/RotatedBox.svelte";

  export const events = createEventDispatcher<{
    shift: Shift;
    reset: undefined;
  }>();

  export let hideTicks: boolean;

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  export let label: string | undefined;

  export let unit: Unit | undefined;

  export let hideLabelUnits: boolean;

  export let disableUnitChange: boolean;

  export let disableInteractivity: boolean;

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  type UnitAction = Signal<{ unit: Unit; callback: () => void } | undefined>;
  export let raiseFactor: UnitAction;
  export let lowerFactor: UnitAction;
  /** unit to reset the axis to */
  export let resetUnit: UnitAction;

  export const textLength = (text: string) =>
    measureText(text, measuringSpan, axis === "x" ? "horizontal" : "vertical");

  // flatten the mutable prop containing a store into a store
  const raiseFactor$ = mut($raiseFactor);
  $: raiseFactor$.set($raiseFactor);
  const lowerFactor$ = mut($lowerFactor);
  $: lowerFactor$.set($lowerFactor);
  const resetUnit$ = mut($resetUnit);
  $: resetUnit$.set($resetUnit);

  const dragCallbacks: MouseDragCallbacks = {
    start: () => {},
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

  const contextItems = disableUnitChange
    ? mut([])
    : ZippedSignal(
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
        resetUnit$.map(($v) => {
          if (!$v) return;
          const { unit, callback } = $v;
          return <const>{
            type: "leaf",
            content: `Reset unit to ${unit.toString()}`,
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
        }),
      ).map((arr) => arr.filter((x) => x) as ContextItem<string>[]);

  let menu: { open(p: Point): void; close(): void };

  // Handle tick text intersecting
  let measuringSpan: HTMLElement;

  function tickSpanStyle(tick: Tick): string {
    const absolutePos =
      axis === "x"
        ? `left: ${(tick.position * 100).toFixed(2)}%`
        : `top: ${((1 - tick.position) * 100).toFixed(2)}%`;

    const transform = `${
      axis === "x" ? "translateX(-50%)" : "translateY(-50%)"
    }`;

    const transformOrigin = "center center";
    return `${absolutePos}; transform: ${transform}; transform-origin: ${transformOrigin};`;
  }

  function maxPerpendicularSize(ticks: Tick[]): number {
    if (!measuringSpan) return 0;
    let direction: "horizontal" | "vertical" =
      axis === "x" ? "vertical" : "horizontal";

    let maxSize = 0;
    for (const tick of ticks) {
      const content =
        tick.value +
        (tick.subvalue !== undefined ? "<br/>" + tick.subvalue : "");
      const size = measureText(content, measuringSpan, direction);

      if (size > maxSize) {
        maxSize = size;
      }
    }

    measuringSpan.style.rotate = "";

    return maxSize;
  }
</script>

<GenericContextMenu items={$contextItems} bind:this={menu} />
<div
  class="axis-container {axis}"
  role="presentation"
  on:contextmenu|preventDefault
  use:mouseClick={{
    callback: (e) => menu.open(e),
    button: MouseButtons.Right,
  }}
>
  {#if label !== undefined}
    {@const labelText =
      label + (!hideLabelUnits && unit ? ` [${unit.toString()}]` : "")}

    {#if axis === "y"}
      <RotatedBox>
        <div class="y label">{labelText}</div>
      </RotatedBox>
    {:else}
      <div style="display: flex; justify-content: center; align-items: center;">
        <div class="{axis} label">{labelText}</div>
      </div>
    {/if}
  {/if}

  {#if !hideTicks}
    <div
      class="{axis} ticks"
      style="{axis === `x` ? `height` : `width`}: {maxPerpendicularSize(ticks) +
        4}px"
      use:mouseDrag={{
        ...dragCallbacks,
        button: MouseButtons.Left,
      }}
      role="presentation"
      on:dblclick={() => events("reset")}
    >
      {#each ticks as tick}
        <span style={tickSpanStyle(tick)}>
          {@html tick.value}
          {#if tick.subvalue}
            <br />
            {@html tick.subvalue}
          {/if}
        </span>
      {/each}
      <span class="measuring-span" bind:this={measuringSpan} />
    </div>
  {/if}
</div>

<style lang="scss">
  .axis-container {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .axis-container.x {
    flex-direction: column-reverse;
  }
  .axis-container.y {
    flex-direction: row;
  }

  .label.y {
    height: fit-content;
    width: max-content;
    transform: rotate(-90deg);
  }
  .ticks-container {
    height: 100%;
    width: 100%;
  }
  .y {
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
    top: 4px;
  }

  .y.ticks > span {
    position: absolute;
    line-height: 1;
    width: max-content;
    right: 4px;
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

  .measuring-span {
    position: absolute;
    bottom: -1;
    left: 0;
    visibility: hidden;
    white-space: nowrap;
  }
</style>
