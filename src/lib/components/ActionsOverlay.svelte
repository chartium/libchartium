<!-- Chart overlay that draw rectangles and line segments on zoom -->
<script lang="ts" context="module">
  export type VisibleAction = {
    zoom?: Zoom;
    shift?: Shift;
    highlightedPoints?: HighlightPoint[];
    /** fraction of y range */
    yThreshold?: number;
  };
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    MouseButtons,
    mouseDrag,
    mouseClick,
    relativeMousemove,
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
    Threshold,
    Zoom,
  } from "../types.js";

  import { scaleCanvas } from "../utils/actions.js";

  import type { ContextItem } from "../contextMenu/contextMenu.js";
  import GenericContextMenu from "../contextMenu/GenericContextMenu.svelte";
  import type { WritableSignal } from "@mod.js/signals";
  import RulerBubble from "./RulerBubble.svelte";
  import type { Chart } from "../state/core/chart.js";
  import { P, match } from "ts-pattern";
  import { mapOpt } from "../utils/mapOpt.js";

  export const events = createEventDispatcher<{
    reset: undefined;
    zoom: Zoom;
    shift: Shift;
    yThreshold: Threshold;
  }>();

  export let visibleAction: WritableSignal<VisibleAction | undefined>;

  export let chart: Chart;
  export let hideHoverPoints: boolean;
  export let hideXRuler: boolean;
  export let hideYRuler: boolean;
  export let hideXBubble: boolean;
  export let hideYBubble: boolean;
  export let disableInteractivity: boolean;
  export let traceHovered: boolean;
  export let commonXRuler: WritableSignal<ChartValue | undefined>;
  export let commonYRuler: WritableSignal<ChartValue | undefined>;

  let thresholdFilterMode: boolean = false;
  export const filterByThreshold = () => {
    thresholdFilterMode = true;
  };

  /** Fractions of the graphs width representing persistent thresholds */
  export let presYThreshFracs: number[] = [];

  let thresholdAddMode: boolean = false;
  export const addPersistentThreshold = () => {
    thresholdAddMode = true;
  };

  // FIXME only for RulerBubble's which should be moved elsewhere
  export let xDisplayUnit: DisplayUnit;
  export let yDisplayUnit: DisplayUnit;

  let canvasRef: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  onMount(() => {
    ctx = canvasRef.getContext("2d")!;
  });

  /** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
  const oneDZoomWindow = 20;

  $: $visibleAction, scheduleDraw();
  $: offsetMousePosition, scheduleDraw();
  $: $commonXRuler, scheduleDraw();
  $: $commonYRuler, scheduleDraw();
  $: if ((thresholdFilterMode || thresholdAddMode) && offsetMousePosition)
    visibleAction.update((a) => {
      return { ...a, yThreshold: 1 - offsetMousePosition![1] / overlayHeight };
    });

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

      presYThreshFracs.forEach(drawThreshold);

      if (action && action.zoom && !disableInteractivity) {
        drawZoom(action.zoom);
      } else if (action && action.shift && !disableInteractivity) {
        drawShift(action.shift);
      } else if (action && action.yThreshold && !disableInteractivity) {
        drawThreshold(action.yThreshold);
      } else if (offsetMousePosition) {
        drawRuler({
          x: offsetMousePosition[0] / overlayWidth,
          y: 1 - offsetMousePosition[1] / overlayHeight,
        });
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

    drawCircle(ctx, [x * overlayWidth, y * overlayHeight], point.radius * 2.5, {
      fillStyle: point.color,
      strokeStyle: point.color,
    });
  }

  function drawZoom(zoom: Zoom) {
    const lineStyle: DrawStyle = {
      dash: [10, 5],
    };

    const windowStyle: DrawStyle = {
      lineWidth: 3,
    };

    const xFrom = zoom.x.from * overlayWidth;
    const xTo = zoom.x.to * overlayWidth;
    const yFrom = (1 - zoom.y.from) * overlayHeight;
    const yTo = (1 - zoom.y.to) * overlayHeight;

    // the big lines
    if (zoom.x.from !== zoom.x.to) {
      drawSegment(ctx, [xFrom, 0], [xFrom, overlayHeight], lineStyle);
      drawSegment(ctx, [xTo, 0], [xTo, overlayHeight], lineStyle);
    }
    if (zoom.y.from !== zoom.y.to) {
      drawSegment(ctx, [0, yFrom], [overlayWidth, yFrom], lineStyle);
      drawSegment(ctx, [0, yTo], [overlayWidth, yTo], lineStyle);
    }

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
    }

    if (zoom.x.from === zoom.x.to) {
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
        [0, (1 - point.y) * overlayHeight],
        [overlayWidth, (1 - point.y) * overlayHeight],
        style,
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
    const arrowStyle: DrawStyle = {
      lineWidth: 1,
      dash: [20, 5],
    };

    if (shift.dx && shift.dy) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx) * overlayWidth;
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy) * overlayHeight;

      drawArrow(
        ctx,
        [fromX, fromY],
        [toX, toY],
        wingLength,
        spreadRad,
        arrowStyle,
      );
    } else if (shift.dx) {
      const fromX = shift.origin.x * overlayWidth;
      const toX = (shift.origin.x + shift.dx) * overlayWidth;

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
    } else if (shift.dy) {
      const fromY = (1 - shift.origin.y) * overlayHeight;
      const toY = (1 - shift.origin.y - shift.dy) * overlayHeight;

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

  function drawThreshold(thresholdFrac: number) {
    const style = {
      dash: [9, 3],
    };
    drawSegment(
      ctx,
      [0, (1 - thresholdFrac) * overlayHeight],
      [overlayWidth, (1 - thresholdFrac) * overlayHeight],
      style,
    );
  }

  const rightDragCallbacks: MouseDragCallbacks = {
    start: () => {},
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

  const leftClickCallback = (_e: MouseEvent) => {
    const yThreshold = visibleAction.get()?.yThreshold;
    if (yThreshold) {
      visibleAction.update((a) => ({
        ...a,
        yThreshold: undefined,
      }));
      if (thresholdFilterMode) {
        events("yThreshold", { thresholdFrac: yThreshold, type: "filtering" });
        thresholdFilterMode = false;
      }
      if (thresholdAddMode) {
        events("yThreshold", { thresholdFrac: yThreshold, type: "persistent" });
        thresholdAddMode = false;
      }
    }
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
  use:mouseClick={{ callback: leftClickCallback, button: MouseButtons.Left }}
  use:relativeMousemove
  on:relativeMousemove={(e) =>
    (offsetMousePosition = [e.detail.offsetX, e.detail.offsetY])}
  on:relativeMousemove
  on:relativeMouseout={() => (offsetMousePosition = undefined)}
  on:relativeMouseout
  on:blur={() => (offsetMousePosition = undefined)}
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

{#if !hideXBubble && offsetMousePosition}
  {@const x = offsetMousePosition[0] + canvasRef.getBoundingClientRect().x}
  {@const y = canvasRef.getBoundingClientRect().bottom}
  <RulerBubble
    axis="x"
    position={{ x, y }}
    value={$commonXRuler}
    displayUnit={xDisplayUnit}
  />
{/if}

{#if !hideYBubble && offsetMousePosition}
  {@const x = canvasRef.getBoundingClientRect().left}
  {@const y = offsetMousePosition[1] + canvasRef.getBoundingClientRect().y}
  <RulerBubble
    axis="y"
    position={{ x, y }}
    value={$commonYRuler}
    displayUnit={yDisplayUnit}
  />
{/if}

<style>
  canvas {
    /* pointer-events: none; */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    color: black;
  }

  canvas.trace-hovered {
    cursor: crosshair;
  }

  :global(.dark) canvas {
    color: #00bc8c;
  }
</style>
