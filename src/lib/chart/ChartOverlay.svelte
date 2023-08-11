<!-- Chart overlay that draw rectangles and line segements on zoom -->

<script lang="ts">
    import { onMount } from "svelte";
    import { leftMouseDrag, rightMouseDrag } from "../../utils/mouseGestures";
    import type { MouseDragCallbacks } from "../../utils/mouseGestures";
    import * as canvas from "./canvas.ts";
    import type { Range } from "../types.ts";

    /** The width of the chart area including the axis */
    export let overlayWidth: number;
    /** The height of the chart area including the axis */
    export let overlayHeight: number;
    /** Call Chart's change range */
    export let updateRange: () => void;
    /** Call Chart's range reset */
    export let resetRange: () => void;

    let canvasRef: HTMLCanvasElement;

    let ctx: CanvasRenderingContext2D;

    onMount(() => {
        ctx = canvasRef.getContext("2d")!;
        ctx.fillStyle = "black"; // FIXME DEBUG
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
    });

    /** Width of the y axis for offset reasons */
    export let yAxisWidth: number;

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

    function drawZoom(
        xZoomFromPosition?: number,
        xZoomToPosition?: number,
        yZoomFromPosition?: number,
        yZoomToPosition?: number
    ) {
        ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
        if (xZoomFromPosition) {
            canvas.drawSegment(
                ctx,
                [xZoomFromPosition, 0],
                [xZoomFromPosition, overlayHeight]
            );
        }
        if (xZoomToPosition) {
            canvas.drawSegment(
                ctx,
                [xZoomToPosition, 0],
                [xZoomToPosition, overlayHeight]
            );
        }
        if (yZoomFromPosition) {
            canvas.drawSegment(
                ctx,
                [0, yZoomFromPosition],
                [overlayWidth, yZoomFromPosition]
            );
        }
        if (yZoomToPosition) {
            canvas.drawSegment(
                ctx,
                [0, yZoomToPosition],
                [overlayWidth, yZoomToPosition]
            );
        }
    }
    $: {
        if (zoomOrMove === "zoom") {
            drawZoom(
                xTransformPositions!.from,
                xTransformPositions!.to,
                yTransformPositions!.from,
                yTransformPositions!.to
            );
        }
    }

    const leftDragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            xTransformPositions = {
                from: e.offsetX + yAxisWidth,
                to: e.offsetX + yAxisWidth,
            };
            yTransformPositions = { from: e.offsetY, to: e.offsetY };
            zoomOrMove = "zoom";
        },
        move: (e) => {
            // handle the situation where the user tries to zoom in only one direction
            const desiredXToPosition = e.offsetX + yAxisWidth;
            const desiredYToPosition = e.offsetY;
            const isXTooClose = Math.abs(xTransformPositions!.from - desiredXToPosition) < oneDZoomWindow;
            const isYTooClose = Math.abs(yTransformPositions!.from - desiredYToPosition) < oneDZoomWindow;
            xTransformPositions!.to = isXTooClose ? xTransformPositions!.from : desiredXToPosition;
            yTransformPositions!.to = isYTooClose ? yTransformPositions!.from : desiredYToPosition;
        },
        end: (e) => {
            // this means the user tried to zoom in only one direction
            if (xTransformPositions!.from === xTransformPositions!.to) {
                xTransformPositions = undefined;
            }
            if (yTransformPositions!.from === yTransformPositions!.to) {
                yTransformPositions = undefined;
            }
            console.log(xTransformPositions, yTransformPositions);
            updateRange();
            xTransformPositions = undefined;
            yTransformPositions = undefined;
            zoomOrMove = "neither";
        },
    };

    function drawMove(
        xFrom?: number,
        xTo?: number,
        yFrom?: number,
        yTo?: number
    ) {
        ctx?.clearRect(0, 0, overlayWidth, overlayHeight);
        const wingLength = 10; // FIXME DEBUG
        const spreadRad = Math.PI / 4; // FIXME DEBUG

        if (xFrom && xTo && yFrom && yTo) {
            canvas.drawArrow(
                ctx,
                [xFrom, yFrom],
                [xTo, yTo],
                wingLength,
                spreadRad
            );
        } else if (xFrom && xTo) {
            canvas.drawSegment(ctx, [xFrom, 0], [xFrom, overlayHeight]);
            canvas.drawSegment(ctx, [xTo, 0], [xTo, overlayHeight]);
            canvas.drawArrow(
                ctx,
                [xFrom, overlayHeight / 2],
                [xTo, overlayHeight / 2],
                wingLength,
                spreadRad
            );
        } else if (yFrom && yTo) {
            canvas.drawSegment(ctx, [0, yFrom], [overlayWidth, yFrom]);
            canvas.drawSegment(ctx, [0, yTo], [overlayWidth, yTo]);
            canvas.drawArrow(
                ctx,
                [overlayWidth / 2, yFrom],
                [overlayWidth / 2, yTo],
                wingLength,
                spreadRad
            );
        }
    }

    $: {
        if (zoomOrMove === "move") {
            drawMove(
                xTransformPositions !== undefined
                    ? xTransformPositions.from
                    : undefined,
                xTransformPositions !== undefined
                    ? xTransformPositions.to
                    : undefined,
                yTransformPositions !== undefined
                    ? yTransformPositions.from
                    : undefined,
                yTransformPositions !== undefined
                    ? yTransformPositions.to
                    : undefined
            );
        }
    }

    const rightDragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            xTransformPositions = {
                from: e.offsetX + yAxisWidth,
                to: e.offsetX + yAxisWidth,
            };
            yTransformPositions = { from: e.offsetY, to: e.offsetY };
            zoomOrMove = "move";
        },
        move: (e) => {
            xTransformPositions!.to = e.offsetX + yAxisWidth;
            yTransformPositions!.to = e.offsetY;
        },
        end: (e) => {
            updateRange();
            xTransformPositions = undefined;
            yTransformPositions = undefined;
            zoomOrMove = "neither";
        },
    };
</script>

<div
    class="container"
    style="width:{overlayWidth}px; height:{overlayHeight}px"
    on:dblclick={resetRange}
>
    <slot name="yAxis" class="yAxis" />
    <div
        class="OverChartSelector"
        use:leftMouseDrag={leftDragCallbacks}
        use:rightMouseDrag={rightDragCallbacks}
    >
        <slot name="chart" class="chart" />
    </div>
    <slot name="xAxis" class="xAxis" />
    <div class="empty" />
    <canvas bind:this={canvasRef} width={overlayWidth} height={overlayHeight} />
</div>

<style>
    .container {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 3fr;
        grid-template-rows: 3fr 1fr;
        grid-column-gap: 0px;
        grid-row-gap: 0px;
    }

    .yAxis {
        grid-area: 1 / 1 / 2 / 2;
        display: flex;
        justify-content: end;
    }
    .xAxis {
        grid-area: 2 / 2 / 3 / 3;
    }
    .chart {
        grid-area: 1 / 2 / 2 / 3;
    }
    .empty {
        grid-area: 2 / 1 / 3 / 2;
    }

    canvas {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
    }
</style>
