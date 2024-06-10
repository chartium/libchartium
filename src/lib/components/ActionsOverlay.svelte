<!-- Chart overlay that draw rectangles and line segments on zoom -->
<script lang="ts" context="module">
  export type VisibleAction = {
    zoom?: Zoom;
    shift?: Shift;
    highlightedPoints?: HighlightPoint[];
  };

  /** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
  export const oneDZoomWindow = 20;
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    MouseButtons,
    mouseDrag,
    mouseClick,
    scrollMouseEvents,
  } from "../utils/mouseActions.js";
  import {
    drawArrow,
    drawCircle,
    drawSegment,
    type DrawStyle,
  } from "./canvas.js";
  import type { MouseDragCallbacks } from "../utils/mouseActions.js";
  import type {
    ChartValue,
    DisplayUnit,
    HighlightPoint,
    Point,
    Shift,
    Zoom,
  } from "../types.js";

  import { scaleCanvas } from "../utils/actions.js";

  import type { ContextItem } from "../contextMenu/contextMenu.js";
  import GenericContextMenu from "../contextMenu/GenericContextMenu.svelte";
  import type { Signal, WritableSignal } from "@mod.js/signals";
  import RulerBubble from "./RulerBubble.svelte";
  import type { Chart } from "../state/core/chart.js";
  import { P, match } from "ts-pattern";
  import { mapOpt } from "../utils/mapOpt.js";

  export const events = createEventDispatcher<{
    reset: undefined;
    zoom: Zoom;
    shift: Shift;
  }>();

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  export let chart: Chart;
  export let hideHoverPoints: boolean;
  export let hideXRuler: boolean;
  export let hideYRuler: boolean;
  export let disableUserRangeChanges$: Signal<{ x?: boolean; y?: boolean }>;
  export let traceHovered: boolean;
  export let commonXRuler: WritableSignal<ChartValue | undefined>;
  export let commonYRuler: WritableSignal<ChartValue | undefined>;

  let canvasRef: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvasRef.getContext("2d")!;
  });

  $: $visibleAction, scheduleDraw();
  $: offsetMousePosition, scheduleDraw();
  $: $commonXRuler, scheduleDraw();
  $: $commonYRuler, scheduleDraw();

  let drawScheduled = false;
  function scheduleDraw() {
    if (drawScheduled) return;

    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      if (ctx) draw();
      else scheduleDraw();
    });

    function draw() {
      const action = $visibleAction;

      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, overlayWidth, overlayHeight);

      const color = getComputedStyle(canvasRef).color;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      const { x: xDisabled = false, y: yDisabled = false } =
        disableUserRangeChanges$.get();

      if (action && action.zoom && !(xDisabled && yDisabled)) {
        drawZoom(action.zoom, { xDisabled, yDisabled });
      } else if (action && action.shift && !(xDisabled && yDisabled)) {
        drawShift(action.shift, { xDisabled, yDisabled });
      } else if (chart) {
        // Global Ruler
        // https://open.spotify.com/track/3vFZheR74pxUkzxqhXTZ2X

        const x = mapOpt(commonXRuler.get(), (v) =>
          chart.valueOnAxis("x").fromQuantity(v).toFraction(),
        );
        const y = mapOpt(commonYRuler.get(), (v) =>
          chart.valueOnAxis("y").fromQuantity(v).toFraction(),
        );

        match({ x, y })
          .with({ x: P.number, y: P.number }, ({ x, y }) =>
            drawRuler({ x, y }, "xy"),
          )
          .with({ x: P.number }, ({ x }) => drawRuler({ x, y: 0 }, "x"))
          .with({ y: P.number }, ({ y }) => drawRuler({ x: 0, y }, "y"));
      }

      if (action && action.highlightedPoints && !hideHoverPoints) {
        for (const point of action.highlightedPoints) {
          drawHighlightPoint(point);
        }
      }
    }
  }

  function drawHighlightPoint(point: HighlightPoint) {
    if (!chart) return;

    const { x, y } = chart
      .point()
      .fromQuantities(point.x, point.y)
      .toFractions();

    drawCircle(
      ctx,
      [x * overlayWidth, y * overlayHeight],
      4 + (point.radius - 1) * 0.3,
      {
        fillStyle: point.color,
        strokeStyle: point.color,
      },
    );
  }

  function drawZoom(
    zoom: Zoom,
    options: { xDisabled: boolean; yDisabled: boolean },
  ) {
    const width = 3;

    const lineStyle: DrawStyle = {
      dash: [10, 5],
    };

    const windowStyle: DrawStyle = {
      lineWidth: width,
    };

    const xFrom = zoom.x.from * overlayWidth;
    const xTo = zoom.x.to * overlayWidth;
    const yFrom = (1 - zoom.y.from) * overlayHeight;
    const yTo = (1 - zoom.y.to) * overlayHeight;
    // the big lines
    if (zoom.x.from !== zoom.x.to && !options.xDisabled) {
      drawSegment(ctx, [xFrom, 0], [xFrom, overlayHeight], lineStyle);
      drawSegment(ctx, [xTo, 0], [xTo, overlayHeight], lineStyle);
    }
    if (zoom.y.from !== zoom.y.to && !options.yDisabled) {
      drawSegment(ctx, [0, yFrom], [overlayWidth, yFrom], lineStyle);
      drawSegment(ctx, [0, yTo], [overlayWidth, yTo], lineStyle);
    }

    const anyDisabled = options.xDisabled || options.yDisabled;

    if (anyDisabled) return;

    // The little 1D zoom windows
    if (zoom.y.from === zoom.y.to) {
      drawSegment(
        ctx,
        [xFrom, yFrom - oneDZoomWindow],
        [xFrom, yFrom + oneDZoomWindow],
        windowStyle,
      );
      drawSegment(
        ctx,
        [xTo, yTo - oneDZoomWindow],
        [xTo, yTo + oneDZoomWindow],
        windowStyle,
      );
    } else if (zoom.x.from === zoom.x.to) {
      drawSegment(
        ctx,
        [xFrom - oneDZoomWindow, yFrom],
        [xFrom + oneDZoomWindow, yFrom],
        windowStyle,
      );
      drawSegment(
        ctx,
        [xFrom - oneDZoomWindow, yTo],
        [xFrom + oneDZoomWindow, yTo],
        windowStyle,
      );
    } else {
      const cornerLen = oneDZoomWindow / 2;

      const corners: [number, number, number, number][] = [
        [xFrom, yFrom, 1, -1],
        [xTo, yFrom, -1, -1],
        [xFrom, yTo, 1, 1],
        [xTo, yTo, -1, 1],
      ];

      for (const [x, y, sX, sY] of corners) {
        drawSegment(
          ctx,
          [x, y - (sY * width) / 2],
          [x, y + sY * cornerLen],
          windowStyle,
        );

        drawSegment(
          ctx,
          [x - (sX * width) / 2, y],
          [x + sX * cornerLen, y],
          windowStyle,
        );
      }
    }
  }

  function drawRuler(point: Point, axes: "x" | "y" | "xy" = "xy") {
    const style = {
      dash: [9, 3],
    };

    if (!hideXRuler && axes.includes("x")) {
      drawSegment(
        ctx,
        [point.x * overlayWidth, 0],
        [point.x * overlayWidth, overlayHeight],
        style,
      );
    }

    if (!hideYRuler && axes.includes("y")) {
      drawSegment(
        ctx,
        [0, point.y * overlayHeight],
        [overlayWidth, point.y * overlayHeight],
        style,
      );
    }
  }

  const leftDragCallbacks: MouseDragCallbacks = {
    start: (_) => {},
    move: (_, status) => {
      visibleAction.update((action) => ({
        ...action,
        zoom: status.relativeZoom,
      }));
    },
    end: (_, status) => {
      visibleAction.update((action) => ({
        highlightedPoints: action?.highlightedPoints,
      }));
      if (!status.beyondThreshold("any")) return;
      const xDisabled = disableUserRangeChanges$.get().x;
      const yDisabled = disableUserRangeChanges$.get().y;
      if (xDisabled && yDisabled) {
        console.warn("Chart interactivity disabled");
        return;
      }

      if (xDisabled && !status.beyondThreshold("y")) {
        console.warn("Interacting with X axis disabled");
        return;
      } else if (yDisabled && !status.beyondThreshold("x")) {
        console.warn("Interacting with Y axis disabled");
        return;
      }

      const notZoomed = { from: 0, to: 1 };
      const zoom = {
        x: xDisabled ? notZoomed : status.relativeZoom.x,
        y: yDisabled ? notZoomed : status.relativeZoom.y,
      };

      if (status.beyondThreshold("any")) events("zoom", zoom);
    },
  };

  function drawShift(
    shift: Shift,
    options: { xDisabled: boolean; yDisabled: boolean },
  ) {
    const wingLength = 15;
    const anyDisabled = options.xDisabled || options.yDisabled;
    const spreadRad =
      shift.dx && shift.dy && !anyDisabled ? Math.PI * 0.25 : Math.PI * 0.35;
    // const lineStyle: canvas.DrawStyle = {
    //   dash: [10, 5],
    // };
    const arrowStyle: DrawStyle = {
      lineWidth: 2,
      dash: [12, 4],
    };

    const shiftingInX = shift.dx !== undefined && !options.xDisabled;
    const shiftingInY = shift.dy !== undefined && !options.yDisabled;

    if (shiftingInX && shiftingInY) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx!) * overlayWidth;
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy!) * overlayHeight;

      drawArrow(
        ctx,
        [fromX, fromY],
        [toX, toY],
        wingLength,
        spreadRad,
        arrowStyle,
      );
    } else if (shiftingInX) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx!) * overlayWidth;

      // canvas.drawSegment(ctx, [fromX, 0], [fromX, overlayHeight], lineStyle);
      // canvas.drawSegment(ctx, [toX, 0], [toX, overlayHeight], lineStyle);
      drawArrow(
        ctx,
        [fromX, (1 - shift.origin.y) * overlayHeight],
        [toX, (1 - shift.origin.y) * overlayHeight],
        wingLength,
        spreadRad,
        arrowStyle,
      );
    } else if (shiftingInY) {
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy!) * overlayHeight;

      // canvas.drawSegment(ctx, [0, fromY], [overlayWidth, fromY], lineStyle);
      // canvas.drawSegment(ctx, [0, toY], [overlayWidth, toY], lineStyle);
      drawArrow(
        ctx,
        [shift.origin.x * overlayWidth, fromY],
        [shift.origin.x * overlayWidth, toY],
        wingLength,
        spreadRad,
        arrowStyle,
      );
    }
  }

  const rightDragCallbacks: MouseDragCallbacks = {
    start: () => {},
    move: (_, status) => {
      const disableInteractivity =
        disableUserRangeChanges$.get().x && disableUserRangeChanges$.get().y;
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
      const xDisabled = disableUserRangeChanges$.get().x;
      const yDisabled = disableUserRangeChanges$.get().y;
      if (status.beyondThreshold("x") && xDisabled) {
        console.warn(
          "Tried to interact with X but that interactivity is disabled",
        );
      }
      if (status.beyondThreshold("y") && yDisabled) {
        console.warn(
          "Tried to interact with Y but that interactivity is disabled",
        );
      }
      visibleAction.update((action) => ({
        highlightedPoints: action?.highlightedPoints,
      }));
      const shift = {
        dx: xDisabled ? 0 : status.relativeShift.dx,
        dy: yDisabled ? 0 : status.relativeShift.dy,
        ...status.relativeShift,
      };
      events("shift", shift);
    },
  };

  let overlayWidth: number = 1;
  let overlayHeight: number = 1;

  let offsetMousePosition: [number, number] | undefined = undefined;

  let options: ContextItem<string>[] = []; // TODO add some options
  let menu: any;
</script>

<GenericContextMenu bind:items={options} bind:this={menu} />

<canvas
  bind:this={canvasRef}
  class:trace-hovered={traceHovered}
  on:dblclick={() => events("reset")}
  on:contextmenu|preventDefault
  use:mouseClick={{
    callback: (e) => {
      menu.open(e);
    },
    button: MouseButtons.Right,
  }}
  on:mousemove
  on:mousemove={(e) => (offsetMousePosition = [e.offsetX, e.offsetY])}
  on:mouseout
  on:mouseout={() => (offsetMousePosition = undefined)}
  on:blur={() => (offsetMousePosition = undefined)}
  on:blur
  use:scrollMouseEvents
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

    color: #00bc8c;
  }

  canvas.trace-hovered {
    cursor: crosshair;
  }
</style>
