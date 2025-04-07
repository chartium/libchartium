<!-- This component handles appearing at specific coordinates and displaying info.
  The slot should not have set position -->

<script lang="ts">
  import { portal } from "svelte-portal";

  /** Corner position where to render this. If undefined, hide self */
  export let position: { x: number; y: number } | undefined = undefined;

  export function close(): void {
    position = undefined;
  }

  /** In what position relative to input position to open the tooltip */
  export let preferredPositioning:
    | "center"
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top-left"
    | "bottom-right"
    | "top-right"
    | "bottom-left" = "top-right";

  $: top = preferredPositioning.includes("top");
  $: bottom = preferredPositioning.includes("bottom");
  $: right = preferredPositioning.includes("right");
  $: left = preferredPositioning.includes("left");

  /** Where the tooltip actually gets displayed */
  let renderPosition: { x: number; y: number } | undefined = undefined;

  /** whether to flip position of self from from one corner to another
   * to avoid overflowing the page */
  export let avoidEdges: boolean = true;

  let bBS: ResizeObserverSize[] | undefined;
  $: container =
    bBS?.[0] === undefined
      ? undefined
      : {
          height: bBS[0].blockSize,
          width: bBS[0].inlineSize,
        };
  let innerWidth: number;
  let innerHeight: number;

  $: if (position !== undefined && container) {
    if (avoidEdges) {
      renderPosition = repairedPosition(
        position,
        container.height,
        container.width,
      );
    } else {
      renderPosition = {
        x: position.x + (left ? 0 : -container.width),
        y: position.y + (top ? 0 : -container.height),
      };
    }
  }

  const clampBetween = (x: number, min: number, max: number) => {
    return Math.min(Math.max(x, min), max);
  };

  /** returns position of self (top left corner) such that it doesn't overflow */
  function repairedPosition(
    positionRelativeToPage: { x: number; y: number },
    tooltipHeight: number,
    tooltipWidth: number,
  ): { x: number; y: number } {
    const { x, y } = positionRelativeToPage;
    let toReturnX;
    let toReturnY;

    if (right) {
      const positionOfRightMenuBoundary = x + tooltipWidth;
      const rightOverflow = positionOfRightMenuBoundary - innerWidth;
      toReturnX = rightOverflow > 0 ? x - tooltipWidth : x;
    }
    if (left) {
      const positionOfLeftMenuBoundary = x - tooltipWidth;
      const leftOverflow = positionOfLeftMenuBoundary;
      toReturnX = leftOverflow < 0 ? x : x - tooltipWidth;
    }
    if (bottom) {
      const positionOfBottomMenuBoundary = y + tooltipHeight;
      const bottomOverflow = positionOfBottomMenuBoundary - innerHeight;
      toReturnY = bottomOverflow > 0 ? y - tooltipHeight : y;
    }
    if (top) {
      const positionOfTopMenuBoundary = y - tooltipHeight;
      const topOverflow = positionOfTopMenuBoundary;
      toReturnY = topOverflow < 0 ? y : y - tooltipHeight;
    }

    return {
      x: clampBetween(
        toReturnX ?? x - tooltipWidth / 2,
        0,
        innerWidth - tooltipWidth,
      ),
      y: clampBetween(
        toReturnY ?? y - tooltipHeight / 2,
        0,
        innerHeight - tooltipHeight,
      ),
    };
  }
</script>

<svelte:window bind:innerHeight bind:innerWidth />
{#if position !== undefined}
  <div
    bind:borderBoxSize={bBS}
    use:portal
    class="tooltip"
    style:top={renderPosition?.y + "px"}
    style:left={renderPosition?.x + "px"}
  >
    <slot />
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    padding: 0px 4px;
    width: fit-content;
    height: fit-content;
    z-index: var(--libchartium-popup-z-index, 100);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
  }
</style>
