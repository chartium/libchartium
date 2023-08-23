<!-- Chart overlay that draw rectangles and line segements on zoom -->
<script lang="ts" context="module">
  export type VisibleAction =
    | {
        zoom: Zoom;
      }
    | {
        shift: Shift;
      };
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    MouseButtons,
    mouseDrag,
    rightMouseClick,
  } from "../../utils/mouseGestures";
  import * as canvas from "./canvas";
  import type { MouseDragCallbacks } from "../../utils/mouseGestures";
  import type { Point, Range, Shift, Zoom } from "../types";

  export const events = createEventDispatcher<{
    reset: undefined;
    zoom: Zoom;
    shift: Shift;
  }>();

  export let visibleAction: Writable<VisibleAction | undefined>;

  let canvasRef: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvasRef.getContext("2d")!;
    ctx.fillStyle = "green"; // FIXME DEBUG
    ctx.strokeStyle = "green";
    ctx.lineWidth = 1;
  });

  /** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
  const oneDZoomWindow = 20;

  function clearCanvas() {
    ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
  }

  $: {
    const current = $visibleAction;

    clearCanvas();

    if (current) {
      if ("zoom" in current) {
        drawZoom(current.zoom);
      } else if ("shift" in current) {
        drawShift(current.shift);
      }
    }
  }

  function drawZoom(zoom: Zoom) {
    const lineStyle: canvas.DrawStyle = {
      dash: [10, 5],
    };

    const windowStyle: canvas.DrawStyle = {
      lineWidth: 3,
    };

    const xFrom = zoom.x.from * overlayWidth;
    const xTo = zoom.x.to * overlayWidth;
    const yFrom = (1 - zoom.y.from) * overlayHeight;
    const yTo = (1 - zoom.y.to) * overlayHeight;

    // the big lines
    if (zoom.x.from !== zoom.x.to) {
      canvas.drawSegment(ctx, [xFrom, 0], [xFrom, overlayHeight], lineStyle);
      canvas.drawSegment(ctx, [xTo, 0], [xTo, overlayHeight], lineStyle);
    }
    if (zoom.y.from !== zoom.y.to) {
      canvas.drawSegment(ctx, [0, yFrom], [overlayWidth, yFrom], lineStyle);
      canvas.drawSegment(ctx, [0, yTo], [overlayWidth, yTo], lineStyle);
    }

    // The little windows
    if (zoom.y.from === zoom.y.to) {
      canvas.drawSegment(
        ctx,
        [xFrom, yFrom - oneDZoomWindow],
        [xFrom, yFrom + oneDZoomWindow],
        windowStyle
      );
      canvas.drawSegment(
        ctx,
        [xTo, yTo - oneDZoomWindow],
        [xTo, yTo + oneDZoomWindow],
        windowStyle
      );
    }

    if (zoom.x.from === zoom.x.to) {
      canvas.drawSegment(
        ctx,
        [xFrom - oneDZoomWindow, yFrom],
        [xFrom + oneDZoomWindow, yFrom],
        windowStyle
      );
      canvas.drawSegment(
        ctx,
        [xFrom - oneDZoomWindow, yTo],
        [xFrom + oneDZoomWindow, yTo],
        windowStyle
      );
    }
  }

  const leftDragCallbacks: MouseDragCallbacks = {
    start: (_) => {},
    move: (_, status) => {
      visibleAction.set({ zoom: status.relativeZoom });
    },
    end: (_, status) => {
      visibleAction.set(undefined);

      if (status.beyondThreshold("any")) events("zoom", status.relativeZoom);
    },
  };

  function drawShift(shift: Shift) {
    ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
    const wingLength = 20;
    const spreadRad = Math.PI / 5;
    const lineStyle: canvas.DrawStyle = {
      dash: [10, 5],
    };
    const arrowStyle: canvas.DrawStyle = {
      lineWidth: 3,
    };

    if (shift.dx && shift.dy) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx) * overlayWidth;
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy) * overlayHeight;

      canvas.drawArrow(
        ctx,
        [fromX, fromY],
        [toX, toY],
        wingLength,
        spreadRad,
        arrowStyle
      );
    } else if (shift.dx) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx) * overlayWidth;

      canvas.drawSegment(ctx, [fromX, 0], [fromX, overlayHeight], lineStyle);
      canvas.drawSegment(ctx, [toX, 0], [toX, overlayHeight], lineStyle);
      canvas.drawArrow(
        ctx,
        [fromX, (1 - shift.origin.y) * overlayHeight],
        [toX, (1 - shift.origin.y) * overlayHeight],
        wingLength,
        spreadRad,
        arrowStyle
      );
    } else if (shift.dy) {
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy) * overlayHeight;

      canvas.drawSegment(ctx, [0, fromY], [overlayWidth, fromY], lineStyle);
      canvas.drawSegment(ctx, [0, toY], [overlayWidth, toY], lineStyle);
      canvas.drawArrow(
        ctx,
        [shift.origin.x * overlayWidth, fromY],
        [shift.origin.x * overlayWidth, toY],
        wingLength,
        spreadRad,
        arrowStyle
      );
    }
  }

  const rightDragCallbacks: MouseDragCallbacks = {
    start: (e) => {},
    move: (_, status) => {
      visibleAction.set({
        shift: status.relativeShift,
      });
    },
    end: (_, status) => {
      visibleAction.set(undefined);
      events("shift", status.relativeShift);
    },
  };

  // FIXME DEbug
  import type { ContextItem } from "../contextMenu/contextMenu.ts";
  import GenericContextMenu from "../contextMenu/GenericContextMenu.svelte";
  import type { Writable } from "svelte/store";
  let menu: any;

  const options: ContextItem[] = [
    {
      type: "leaf",
      content: "First option",
      callback: () => console.log("First option clicked"),
    },
    {
      type: "leaf",
      content: "Second option above separator",
      callback: () => console.log("Second option clicked"),
    },
    {
      type: "separator",
    },
    {
      type: "branch",
      content: "Submenu",
      children: [
        {
          type: "leaf",
          content: "First option in submenu",
          callback: () => console.log("First option in submenu clicked"),
        },
        {
          type: "branch",
          content: "Submenu in submenu",
          children: [
            {
              type: "leaf",
              content: "First option in submenu in submenu",
              callback: () =>
                console.log("First option in submenu in submenu clicked"),
            },
            {
              type: "leaf",
              content: "Second option in submenu in submenu",
              callback: () =>
                console.log("Second option in submenu in submenu clicked"),
            },
          ],
        },

        {
          type: "leaf",
          content: "Second option in submenu",
          callback: () => console.log("Second option in submenu clicked"),
        },
      ],
    },
    {
      type: "leaf",
      content: "Last option below Submenu",
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
  role="region"
  on:dblclick={() => events("reset")}
  bind:clientWidth={overlayWidth}
  bind:clientHeight={overlayHeight}
  on:contextmenu|preventDefault
  use:mouseDrag={{
    ...leftDragCallbacks,
    button: MouseButtons.Left,
    threshold: oneDZoomWindow,
  }}
  use:mouseDrag={{ ...rightDragCallbacks, button: MouseButtons.Right }}
  use:rightMouseClick={(e) => {
    menu.open({ x: e.pageX, y: e.pageY });
  }}
>
  <canvas bind:this={canvasRef} width={overlayWidth} height={overlayHeight} />
</div>

<style>
  .container {
    position: absolute;
    inset: 0;

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
