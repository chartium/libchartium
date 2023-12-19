<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { MouseButtons, mouseDrag } from "../utils/mouseGestures.js";
  import {
    mouseClick,
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
  import { doOverlap, measureText } from "../utils/format.js";

  export const events = createEventDispatcher<{
    shift: Shift;
    reset: undefined;
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

  export const textLength = (text: string) =>
    measureText(text, measuringSpan, axis === "x" ? "horizontal" : "vertical");

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

  // Handle tick text intersecting
  let overlaps: boolean = false;
  let measuringSpan: HTMLElement;
  function updateOverlap(ticks: Tick[]) {
    const axisMainDim = axis === "x" ? axisWidth : axisHeight;
    overlaps =
      doOverlap(
        ticks.map((tick) => ({
          text: tick.value,
          position: tick.position * axisMainDim,
        })),
        measuringSpan,
        axis === "y" ? "vertical" : "horizontal"
      ) ||
      doOverlap(
        ticks.map((tick) => ({
          text: tick.subvalue ?? "",
          position: tick.position * axisMainDim,
        })),
        measuringSpan,
        axis === "y" ? "vertical" : "horizontal"
      );
  }
  $: if (measuringSpan) {
    updateOverlap(ticks);
  }

  function tickSpanStyle(tick: Tick, overlaps: boolean): string {
    const absolutePos =
      axis === "x"
        ? `left: ${(tick.position * 100).toFixed(2)}%`
        : `top: ${((1 - tick.position) * 100).toFixed(2)}%`;

    const overlapRotation = overlaps
      ? `${axis === "x" ? "rotate(45deg)" : "rotate(45deg)"} ${
          tick.subvalue !== undefined ? "translateX(-1.5em)" : ""
        }`
      : `${axis === "x" ? "translateX(-50%)" : "translateY(-50%)"}`;

    const transformOrigin = overlaps
      ? `${axis === "x" ? "center left" : "top right"}`
      : "center center";
    return `${absolutePos}; transform: ${overlapRotation}; transform-origin: ${transformOrigin};`;
  }

  function maxPerpendicularSize(ticks: Tick[]): number {
    if (!measuringSpan) return 0;
    let direction: "horizontal" | "vertical" =
      axis === "x" ? "vertical" : "horizontal";

    if (overlaps) {
      measuringSpan.style.rotate = "45deg";
    }

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
  use:mouseClick={{ callback: (e) => menu.open(e), button: MouseButtons.Right }}
  on:dblclick={() => events("reset")}
>
  {#if !hideTicks}
    <div
      class="{axis} ticks"
      style="{axis === `x` ? `height` : `width`}: {maxPerpendicularSize(ticks) +
        4}px"
    >
      {#each ticks as tick}
        <span style={tickSpanStyle(tick, overlaps)}>
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
  .ticks-container {
    height: 100%;
    width: 100%;
  }
  .y {
    writing-mode: sideways-lr; /* doesnt work on chromium based */
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
