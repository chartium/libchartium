<!-- Component creating both the X and Y axis -->

<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { MouseButtons, mouseDrag } from "../utils/mouseActions.js";
  import {
    mouseClick,
    type MouseDragCallbacks,
  } from "../utils/mouseActions.js";
  import {
    isUnit,
    type DisplayUnit,
    type Point,
    type Shift,
    type Tick,
  } from "../types.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";
  import { type ContextItem, GenericContextMenu } from "./context-menu/mod.js";
  import {
    FlockRegistry,
    mut,
    Signal,
    WritableSignal,
    ZippedSignal,
  } from "@typek/signalhead";
  import { measureText } from "../utils/format.js";
  import RotatedBox from "../utils/RotatedBox.svelte";
  import { noop } from "lodash-es";
  import { mapOpt } from "../utils/mapOpt.js";
  import type { UnitChangeActions } from "../state/core/axis.js";
  import type { ChartStyleSheet } from "../state/core/style.js";

  export const dispatchEvent = createEventDispatcher<{
    shift: Shift;
    reset: undefined;
  }>();

  export let hideTicks: boolean;

  /** Whether the axis is for x or y. Determines label orientation and selection positions */
  export let axis: "x" | "y";
  /** Ticks on the axis. Position is to be between 0 and 1 */
  export let ticks: Tick[];

  export let label: string | undefined;

  export let unit: DisplayUnit;

  export let hideLabelUnits: boolean;

  export let disableUnitChange: boolean;

  export let disableInteractivity: Signal<boolean>;

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  export let chartStylesheet: Partial<ChartStyleSheet> = {};
  const tickClass = `${chartStylesheet?.ticks?.className ?? ""} ${chartStylesheet?.[`ticks.${axis}`]?.className ?? ""}`;
  const tickStyle = `${chartStylesheet?.ticks?.style ?? ""} ${chartStylesheet?.[`ticks.${axis}`]?.style ?? ""}`;

  export let dimensionFlock: FlockRegistry<number> | undefined;
  let contentRect: DOMRect | undefined;
  const minorDim = mut<number>(0);
  $: mapOpt(axis === "x" ? contentRect?.height : contentRect?.width, (d) =>
    minorDim.set(d),
  );
  $: onDestroy(dimensionFlock?.register(minorDim) ?? noop);

  export const textLength = (text: string) =>
    measuringSpan !== undefined ? measureText(text, measuringSpan) : 0;

  export let unitChangeActions: Signal<UnitChangeActions>;

  // flatten the mutable prop containing a store into a store
  const unitChangeActions$ = mut($unitChangeActions);
  $: unitChangeActions$.set($unitChangeActions);

  const dragCallbacks: MouseDragCallbacks = {
    start: () => {},
    move: (_, status) => {
      if (disableInteractivity.get()) return;
      const shift = status.relativeShift;

      if (axis === "x") {
        shift.origin.y = 0.1;
        delete shift.dy;
      }
      if (axis === "y") {
        shift.origin.x = 0.1;
        delete shift.dx;
      }
      visibleAction.set({ shift });
    },
    end: (_, status) => {
      if (disableInteractivity.get()) {
        console.warn("Chart interactivity disabled");
        return;
      }
      const shift = status.relativeShift;

      if (axis === "x") delete shift.dy;
      if (axis === "y") delete shift.dx;

      dispatchEvent("shift", shift);
      visibleAction.set(undefined);
    },
  };

  const contextItems = disableUnitChange
    ? mut([])
    : ZippedSignal(
        unitChangeActions$
          .map((v) => v.bestFit)
          .skipEqual()
          .map((v) => {
            if (!v) return;
            const { unit, callback } = v;
            return <const>{
              type: "leaf",
              content: `Fit to best unit ${unit}`,
              callback() {
                callback();
                menu.close();
              },
            };
          }),
        unitChangeActions$
          .map((v) => v.raise)
          .skipEqual()
          .map((v) => {
            if (!v) return;
            const { unit, callback } = v;
            return <const>{
              type: "leaf",
              content: `Raise unit to ${unit}`,
              callback() {
                callback();
                menu.close();
              },
            };
          }),
        unitChangeActions$
          .map((v) => v.reset)
          .skipEqual()
          .map((v) => {
            if (!v) return;
            const { unit, callback } = v;
            return <const>{
              type: "leaf",
              content: `Reset unit to ${unit}`,
              callback() {
                callback();
                menu.close();
              },
            };
          }),
        unitChangeActions$
          .map((v) => v.lower)
          .skipEqual()
          .map((v) => {
            if (!v) return;
            const { unit, callback } = v;
            return <const>{
              type: "leaf",
              content: `Lower unit to ${unit}`,
              callback() {
                callback();
                menu.close();
              },
            };
          }),
      ).map(([bestUnit, ...arr_]): ContextItem<string>[] => {
        let items = arr_.filter((x) => x) as ContextItem<string>[];

        if (bestUnit) {
          return [...items, { type: "separator" }, bestUnit];
        }

        return items;
      });

  let menu: { open(p: Point): void; close(): void };

  // Handle tick text intersecting
  let measuringSpan: HTMLElement;

  function tickSpanStyle(tick: Tick): string {
    const absolutePos =
      axis === "x"
        ? `margin-x: -100%; left: ${(tick.position * 100).toFixed(2)}%`
        : `margin-y: -100%; top: ${((1 - tick.position) * 100).toFixed(2)}%`;

    const transform = `${
      axis === "x" ? "translateX(-50%)" : "translateY(-50%)"
    }`;

    const transformOrigin = "center center";
    return `${absolutePos}; transform: ${transform}; transform-origin: ${transformOrigin};`;
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
  bind:contentRect
>
  {#if label !== undefined}
    {@const labelText =
      label + (!hideLabelUnits && isUnit(unit) ? ` [${unit.toString()}]` : "")}

    {#if axis === "y"}
      <RotatedBox>
        <div style={tickStyle} class="y label {tickClass}">{labelText}</div>
      </RotatedBox>
    {:else}
      <div style="display: flex; justify-content: center; align-items: center;">
        <div style={tickStyle} class="{axis} label {tickClass}">
          {labelText}
        </div>
      </div>
    {/if}
  {/if}

  {#if !hideTicks}
    <div
      class="{axis} ticks"
      use:mouseDrag={{
        ...dragCallbacks,
        button: MouseButtons.Left,
      }}
      use:mouseDrag={{
        ...dragCallbacks,
        button: MouseButtons.Right,
      }}
      role="presentation"
      on:dblclick={() => dispatchEvent("reset")}
    >
      {#each ticks as tick}
        <span style={tickSpanStyle(tick)}>
          <div class="{axis} innermost {tickClass}" style={tickStyle}>
            {tick.text}
            {#if tick.subtext}
              <br />
              {tick.subtext}
            {/if}
          </div>
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
  }
  .ticks-container {
    height: 100%;
    width: 100%;
  }
  .ticks {
    position: static;
    display: flex;
  }
  .x.ticks {
    padding-top: 4px;
    padding-bottom: 4px;
    flex-direction: row;
    align-items: start;
    width: 100%;
  }
  .y.ticks {
    padding-left: 4px;
    flex-direction: column;
    align-items: end;
    height: 100%;
  }
  .x.ticks > span {
    position: relative;
    line-height: 1;
    width: 0;
    top: 4px;
  }
  .y.ticks > span {
    position: relative;
    line-height: 1;
    right: 4px;
    height: 0;
    overflow: visible;
  }
  .x.innermost {
    width: max-content;
    height: fit-content;
    transform: translateX(-50%);
  }
  .y.innermost {
    width: max-content;
    height: fit-content;
    transform: translateY(-50%);
  }

  span,
  .tooltip,
  .ticks {
    user-select: none;
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
