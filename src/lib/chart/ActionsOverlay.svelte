<!-- Chart overlay that draw rectangles and line segements on zoom -->
<script lang="ts" context="module">
  export type VisibleAction = {
    zoom?: Zoom;
    shift?: Shift;
    highlightedPoints?: HighlightPoint[];
  };
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    MouseButtons,
    mouseDrag,
    rightMouseClick,
  } from "../utils/mouseGestures.js";
  import * as canvas from "./canvas.js";
  import type { MouseDragCallbacks } from "../utils/mouseGestures.js";
  import type { HighlightPoint, Point, Shift, Zoom } from "../types.js";

  import { scaleCanvas } from "../utils/actions.js";

  import type { ContextItem } from "../contextMenu/contextMenu.js";
  import GenericContextMenu from "../contextMenu/GenericContextMenu.svelte";
  import type { WritableSignal } from "@mod.js/signals";

  export const events = createEventDispatcher<{
    reset: undefined;
    zoom: Zoom;
    shift: Shift;
  }>();

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  export let hideHoverPoints: boolean;
  export let hideXRuler: boolean;
  export let hideYRuler: boolean;
  export let disableInteractivity: boolean;

  let canvasRef: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvasRef.getContext("2d")!;
  });

  /** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
  const oneDZoomWindow = 20;

  $: $visibleAction, scheduleDraw();
  $: mousePosition, scheduleDraw();

  let _frame: number | undefined = undefined;
  function scheduleDraw() {
    function draw() {
      const action = $visibleAction;

      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, overlayWidth, overlayHeight);

      const color = getComputedStyle(canvasRef).color;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      if (action && action.highlightedPoints && !hideHoverPoints) {
        for (const point of action.highlightedPoints) {
          drawHighlightPoint(point);
        }
      }
      if (action && action.zoom && !disableInteractivity) {
        drawZoom(action.zoom);
      } else if (action && action.shift && !disableInteractivity) {
        drawShift(action.shift);
      } else if (mousePosition) {
        drawRuler(
          {
            x: mousePosition[0] / overlayWidth,
            y: 1 - mousePosition[1] / overlayHeight,
          },
          false
        );
      }
      // TODO: global ruler
    }

    if (_frame) return;

    _frame = requestAnimationFrame(() => {
      _frame = undefined;
      draw();
    });
  }

  function drawHighlightPoint(point: HighlightPoint) {
    const style: canvas.DrawStyle = {
      fillStyle: `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`,
      strokeStyle: `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`,
    };
    canvas.drawCircle(
      ctx,
      [point.xFraction * overlayWidth, (1 - point.yFraction) * overlayHeight],
      point.radius * 2.5,
      style
    );
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

    // The little 1D zoom windows
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

  function drawRuler(point: Point, xOnly: boolean) {
    const style = {
      dash: [9, 3],
    };

    if (!hideYRuler) {
      canvas.drawSegment(
        ctx,
        [point.x * overlayWidth, 0],
        [point.x * overlayWidth, overlayHeight],
        style
      );
    }

    if (!xOnly && !hideXRuler) {
      canvas.drawSegment(
        ctx,
        [0, (1 - point.y) * overlayHeight],
        [overlayWidth, (1 - point.y) * overlayHeight],
        style
      );
    }
  }

  const leftDragCallbacks: MouseDragCallbacks = {
    start: (_) => {},
    move: (_, status) => {
      if (disableInteractivity) {
        console.log("Chart interactivity disabled!");
        return;
      }
      visibleAction.update((action) => ({
        ...action,
        zoom: status.relativeZoom,
      }));
    },
    end: (_, status) => {
      if (disableInteractivity) {
        console.log("Chart interactivity disabled!");
        return;
      }
      visibleAction.update((action) => ({
        highlightedPoints: action?.highlightedPoints,
      }));
      if (status.beyondThreshold("any")) events("zoom", status.relativeZoom);
    },
  };

  function drawShift(shift: Shift) {
    const wingLength = 20;
    const spreadRad = shift.dx && shift.dy ? Math.PI / 5 : Math.PI * 0.4;
    // const lineStyle: canvas.DrawStyle = {
    //   dash: [10, 5],
    // };
    const arrowStyle: canvas.DrawStyle = {
      lineWidth: 1,
      dash: [20, 5],
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

      // canvas.drawSegment(ctx, [fromX, 0], [fromX, overlayHeight], lineStyle);
      // canvas.drawSegment(ctx, [toX, 0], [toX, overlayHeight], lineStyle);
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

      // canvas.drawSegment(ctx, [0, fromY], [overlayWidth, fromY], lineStyle);
      // canvas.drawSegment(ctx, [0, toY], [overlayWidth, toY], lineStyle);
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
      if (disableInteractivity) {
        console.log("Chart interactivity disabled!");
        return;
      }
      visibleAction.update((action) => ({
        ...action,
        shift: status.relativeShift,
      }));
    },
    end: (_, status) => {
      if (disableInteractivity) {
        console.log("Chart interactivity disabled!");
        return;
      }
      visibleAction.update((action) => ({
        highlightedPoints: action?.highlightedPoints,
      }));
      events("shift", status.relativeShift);
    },
  };

  let overlayWidth: number = 1;
  let overlayHeight: number = 1;

  let mousePosition: [number, number] | undefined = undefined;

  let options: ContextItem<string>[] = [
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
      type: "branch",
      content: "even more options??",
      children: [
        {
          type: "leaf",
          content: "First option in submenu",
          callback: () => console.log("First option in submenu clicked"),
        },
        {
          type: "leaf",
          content: "Second option in submenu",
          callback: () => console.log("Second option in submenu clicked"),
        },
      ],
    },
  ];
  let menu: any;
</script>

<GenericContextMenu bind:items={options} bind:this={menu} />

<canvas
  bind:this={canvasRef}
  on:dblclick={() => events("reset")}
  on:contextmenu|preventDefault
  use:rightMouseClick={(e) => {
    menu.open(e);
  }}
  on:mousemove={(e) => (mousePosition = [e.offsetX, e.offsetY])}
  on:mousemove
  on:mouseout={() => (mousePosition = undefined)}
  on:mouseout
  on:blur={() => (mousePosition = undefined)}
  on:blur
  use:scaleCanvas={([width, height]) => {
    overlayWidth = width;
    overlayHeight = height;
  }}
  use:mouseDrag={{
    ...leftDragCallbacks,
    button: MouseButtons.Left,
    threshold: oneDZoomWindow,
  }}
  use:mouseDrag={{ ...rightDragCallbacks, button: MouseButtons.Right }}
/>

<style>
  canvas {
    /* pointer-events: none; */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    color: black;
  }

  :global(.dark) canvas {
    color: #00bc8c;
  }
</style>
