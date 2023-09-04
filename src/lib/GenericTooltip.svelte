<!-- This component handles appearing at specific coordinates and displaying info. 
  The slot should not have set position -->

<script lang="ts">
  /** Corner position where to render this. If undefined, hide self */
  export let position: { x: number; y: number } | undefined = undefined;

  export function close(): void {
    position = undefined;
  }

  /** In what quadrant relative to input position to open the tooltip */
  export let preferedQuadrant:
    | "top-left"
    | "bottom-right"
    | "top-right"
    | "bottom-left" = "bottom-right";

  $: top = preferedQuadrant.includes("top");
  $: left = preferedQuadrant.includes("left");

  /** Where the tooltip actually gets displayed */
  let renderPosition: { x: number; y: number } | undefined = undefined;

  /** whether to flip position of self from from one corner to another
   * to avoid overflowing the page */
  export let avoidEdges: boolean = true;

  let container: HTMLElement;

  $: if (position !== undefined) {
    if (avoidEdges) {
      renderPosition = repairedPosition(
        position,
        container?.clientHeight,
        container?.clientWidth
      );
    } else {
      renderPosition = {
        x: position.x + (left ? 0 : -container?.clientWidth),
        y: position.y + (top ? 0 : -container?.clientHeight),
      };
    }
  }

  /** returns position of self (top left corner) such that it doesn't overflow */
  function repairedPosition(
    positionRelativeToPage: { x: number; y: number },
    tooltipHeight: number,
    tooltipWidth: number
  ): { x: number; y: number } {
    const { x, y } = positionRelativeToPage;
    const { innerWidth, innerHeight } = window;
    let toReturnX;
    let toReturnY;

    if (!left) {
      const positionOfRightMenuBoundary = x + tooltipWidth + 3;
      const rightOverflow = positionOfRightMenuBoundary - innerWidth;
      toReturnX = rightOverflow > 0 ? x - container.clientWidth : x;
    } else {
      const positionOfLeftMenuBoundary = x - tooltipWidth - 3;
      const leftOverflow = positionOfLeftMenuBoundary;
      toReturnX = leftOverflow < 0 ? x : x - container.clientWidth;
    }
    if (!top) {
      const positionOfBottomMenuBoundary = y + tooltipHeight + 3;
      const bottomOverflow = positionOfBottomMenuBoundary - innerHeight;
      toReturnY = bottomOverflow > 0 ? y - container.clientHeight : y;
    } else {
      const positionOfTopMenuBoundary = y - tooltipHeight - 3;
      const topOverflow = positionOfTopMenuBoundary;
      toReturnY = topOverflow < 0 ? y : y - container.clientHeight;
    }
    return {
      x: toReturnX,
      y: toReturnY,
    };
  }
</script>

<div
  bind:this={container}
  style:visibility={position === undefined ? "hidden" : "visible"}
  style:top={renderPosition?.y + "px"}
  style:left={renderPosition?.x + "px"}
  style="position: fixed;
  height: fit-content;
  width: fit-content;
  z-index: 1;
  pointer-events: none;"
>
  <slot />
</div>
