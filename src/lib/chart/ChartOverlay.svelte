<!-- Chart overlay that draw rectangles and line segements on zoom -->

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    leftMouseDrag,
    rightMouseDrag,
    rightMouseClick,
  } from "../../utils/mouseGestures";
  import type { MouseDragCallbacks } from "../../utils/mouseGestures";
  import * as canvas from "./canvas.ts";
  import type { Range, Shift, Zoom } from "../types.ts";

  export const events = createEventDispatcher<{
    reset: {};
    zoom: Zoom;
    shift: Shift;
  }>();

  let canvasRef: HTMLCanvasElement;

  let ctx: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvasRef.getContext("2d")!;
    ctx.fillStyle = "green"; // FIXME DEBUG
    ctx.strokeStyle = "green";
    ctx.lineWidth = 1;
  });

  // for drawing
  /** new border values of y range */
  export let yTransformPositions: Range | undefined;
  /** new border values of x range */
  export let xTransformPositions: Range | undefined;

  /** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
  const oneDZoomWindow = 20;

  export let zoomOrMove: "move" | "zoom" | "neither" = "neither";

  function clearCanvas() {
    ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
  }

  $: {
    if (zoomOrMove === "neither") {
      clearCanvas();
    }
  }

  function drawZoom(xZoomPosition: Range, yZoomPosition: Range) {
    ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
    const lineStyle: canvas.DrawStyle = {
      dash: [10, 5],
    };

    const windowStyle: canvas.DrawStyle = {
      lineWidth: 3,
    };

    // the big lines
    if (xZoomPosition?.from !== xZoomPosition?.to) {
      canvas.drawSegment(
        ctx,
        [xZoomPosition.from, 0],
        [xZoomPosition.from, overlayHeight],
        lineStyle
      );
      canvas.drawSegment(
        ctx,
        [xZoomPosition.to, 0],
        [xZoomPosition.to, overlayHeight],
        lineStyle
      );
    }
    if (yZoomPosition?.from !== yZoomPosition?.to) {
      canvas.drawSegment(
        ctx,
        [0, yZoomPosition.from],
        [overlayWidth, yZoomPosition.from],
        lineStyle
      );
      canvas.drawSegment(
        ctx,
        [0, yZoomPosition.to],
        [overlayWidth, yZoomPosition.to],
        lineStyle
      );
    }

    // The little windows
    if (yZoomPosition.from === yZoomPosition?.to) {
      canvas.drawSegment(
        ctx,
        [xZoomPosition.from, yZoomPosition.from - oneDZoomWindow],
        [xZoomPosition.from, yZoomPosition.from + oneDZoomWindow],
        windowStyle
      );
      canvas.drawSegment(
        ctx,
        [xZoomPosition.to, yZoomPosition.to - oneDZoomWindow],
        [xZoomPosition.to, yZoomPosition.to + oneDZoomWindow],
        windowStyle
      );
    }

    if (xZoomPosition.from === xZoomPosition?.to) {
      canvas.drawSegment(
        ctx,
        [xZoomPosition.from - oneDZoomWindow, yZoomPosition.from],
        [xZoomPosition.from + oneDZoomWindow, yZoomPosition.from],
        windowStyle
      );
      canvas.drawSegment(
        ctx,
        [xZoomPosition.from - oneDZoomWindow, yZoomPosition.to],
        [xZoomPosition.from + oneDZoomWindow, yZoomPosition.to],
        windowStyle
      );
    }
  }
  $: {
    if (zoomOrMove === "zoom") {
      if (xTransformPositions && yTransformPositions) {
        drawZoom(xTransformPositions, yTransformPositions);
      }
    }
  }

  const leftDragCallbacks: MouseDragCallbacks = {
    start: (e) => {
      xTransformPositions = {
        from: e.offsetX,
        to: e.offsetX,
      };
      yTransformPositions = { from: e.offsetY, to: e.offsetY };
      zoomOrMove = "zoom";
    },
    move: (e) => {
      // handle the situation where the user tries to zoom in only one direction
      const desiredXToPosition = e.offsetX;
      const desiredYToPosition = e.offsetY;
      const isXTooClose =
        Math.abs(xTransformPositions!.from - desiredXToPosition) <
        oneDZoomWindow;
      const isYTooClose =
        Math.abs(yTransformPositions!.from - desiredYToPosition) <
        oneDZoomWindow;
      xTransformPositions!.to = isXTooClose
        ? xTransformPositions!.from
        : desiredXToPosition;
      yTransformPositions!.to = isYTooClose
        ? yTransformPositions!.from
        : desiredYToPosition;
    },
    end: (e) => {
      const zoom: Zoom = {
        x: { from: 0, to: 0 },
        y: { from: 0, to: 1 },
      };

      // this means the user tried to zoom in only one direction
      for (const [axis, positions, axisSize] of [
        ["x", xTransformPositions, overlayWidth] as const,
        ["y", yTransformPositions, overlayHeight] as const,
      ]) {
        if (!positions || positions.from === positions.to) continue;

        const [from, to] = (<const>["from", "to"])
          .map((side) =>
            axis === "x"
              ? positions[side] / axisSize
              : 1 - positions[side] / axisSize
          )
          .sort();

        zoom[axis] = { from, to };
      }

      events("zoom", zoom);

      xTransformPositions = undefined;
      yTransformPositions = undefined;
      zoomOrMove = "neither";
    },
  };

  function drawMove(xMovePosition?: Range, yMovePosition?: Range) {
    ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
    const wingLength = 20;
    const spreadRad = Math.PI / 5;
    const lineStyle: canvas.DrawStyle = {
      dash: [10, 5],
    };
    const arrowStyle: canvas.DrawStyle = {
      lineWidth: 3,
    };

    if (xMovePosition && yMovePosition) {
      canvas.drawArrow(
        ctx,
        [xMovePosition.from, yMovePosition.from],
        [xMovePosition.to, yMovePosition.to],
        wingLength,
        spreadRad,
        arrowStyle
      );
    } else if (xMovePosition) {
      canvas.drawSegment(
        ctx,
        [xMovePosition.from, 0],
        [xMovePosition.from, overlayHeight],
        lineStyle
      );
      canvas.drawSegment(
        ctx,
        [xMovePosition.to, 0],
        [xMovePosition.to, overlayHeight],
        lineStyle
      );
      canvas.drawArrow(
        ctx,
        [xMovePosition.from, overlayHeight / 2],
        [xMovePosition.to, overlayHeight / 2],
        wingLength,
        spreadRad,
        arrowStyle
      );
    } else if (yMovePosition) {
      canvas.drawSegment(
        ctx,
        [0, yMovePosition.from],
        [overlayWidth, yMovePosition.from],
        lineStyle
      );
      canvas.drawSegment(
        ctx,
        [0, yMovePosition.to],
        [overlayWidth, yMovePosition.to],
        lineStyle
      );
      canvas.drawArrow(
        ctx,
        [overlayWidth / 2, yMovePosition.from],
        [overlayWidth / 2, yMovePosition.to],
        wingLength,
        spreadRad,
        arrowStyle
      );
    }
  }

  $: {
    if (zoomOrMove === "move") {
      drawMove(xTransformPositions, yTransformPositions);
    }
  }

  const rightDragCallbacks: MouseDragCallbacks = {
    start: (e) => {
      xTransformPositions = {
        from: e.offsetX,
        to: e.offsetX,
      };
      yTransformPositions = { from: e.offsetY, to: e.offsetY };
      zoomOrMove = "move";
    },
    move: (e) => {
      xTransformPositions!.to = e.offsetX;
      yTransformPositions!.to = e.offsetY;
    },
    end: (e) => {
      if (zoomOrMove === "move") {
        const shift = { dx: 0, dy: 0 };

        for (const [key, range, axisSize] of [
          ["dx", xTransformPositions, overlayWidth] as const,
          ["dy", yTransformPositions, -overlayHeight] as const,
        ]) {
          if (!range) continue;

          const diff = range.to - range.from;
          shift[key] = -diff / axisSize;
        }

        events("shift", shift);
      }

      xTransformPositions = undefined;
      yTransformPositions = undefined;
      zoomOrMove = "neither";
    },
  };

  // FIXME DEbug
  import type { ContextItem } from "../types";
  import GenericContextMenu from "../contextMenu/GenericContextMenu.svelte";
  let menu: any;

  const options: ContextItem[] = [
    {
      type: "leaf",
      text: "First option",
      callback: () => console.log("First option clicked"),
    },
    {
      type: "leaf",
      text: "Second option above separator",
      callback: () => console.log("Second option clicked"),
    },
    {
      type: "separator",
    },
    {
      type: "branch",
      text: "Submenu",
      children: [
        {
          type: "leaf",
          text: "First option in submenu",
          callback: () => console.log("First option in submenu clicked"),
        },
        {
          type: "branch",
          text: "Submenu in submenu",
          children: [
            {
              type: "leaf",
              text: "First option in submenu in submenu",
              callback: () =>
                console.log("First option in submenu in submenu clicked"),
            },
            {
              type: "leaf",
              text: "Second option in submenu in submenu",
              callback: () =>
                console.log("Second option in submenu in submenu clicked"),
            },
          ],
        },

        {
          type: "leaf",
          text: "Second option in submenu",
          callback: () => console.log("Second option in submenu clicked"),
        },
      ],
    },
    {
      type: "leaf",
      text: "Last option below Submenu",
      callback: () => console.log("Last option clicked"),
    },
  ];

  // FIXME DEbug
  $: (window as any).menu = menu;

  let overlayWidth: number = 1;
  let overlayHeight: number = 1;
</script>

<GenericContextMenu items={options} bind:this={menu} />

<div
  class="container"
  on:dblclick={() => events("reset")}
  use:rightMouseClick={(e) => {
    menu.open({ x: e.pageX, y: e.pageY });
  }}
  bind:clientWidth={overlayWidth}
  bind:clientHeight={overlayHeight}
  on:contextmenu|preventDefault
>
  <div
    class="OverChartSelector"
    use:leftMouseDrag={leftDragCallbacks}
    use:rightMouseDrag={rightDragCallbacks}
  >
    <slot name="chart" class="chart" />
  </div>

  <canvas bind:this={canvasRef} width={overlayWidth} height={overlayHeight} />
</div>

<style>
  .container {
    position: absolute;
    inset: 0;

    width: 100%;
    height: 100%;
  }

  .OverChartSelector {
    width: 100%;
    height: 100%;
  }

  canvas {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
