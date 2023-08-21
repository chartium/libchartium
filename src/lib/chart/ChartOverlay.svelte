<!-- Chart overlay that draw rectangles and line segements on zoom -->

<script lang="ts">
    import { onMount } from "svelte";
    import {
        leftMouseDrag,
        rightMouseDrag,
        rightMouseClick,
    } from "../../utils/mouseGestures";
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
        ctx.fillStyle = "green"; // FIXME DEBUG
        ctx.strokeStyle = "green";
        ctx.lineWidth = 1;
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
            // this means the user tried to zoom in only one direction
            if (xTransformPositions?.from === xTransformPositions?.to) {
                xTransformPositions = undefined;
            }
            if (yTransformPositions?.from === yTransformPositions?.to) {
                yTransformPositions = undefined;
            }
            updateRange();
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
                    callback: () =>
                        console.log("First option in submenu clicked"),
                },
                {
                    type: "branch",
                    text: "Submenu in submenu",
                    children: [
                        {
                            type: "leaf",
                            text: "First option in submenu in submenu",
                            callback: () =>
                                console.log(
                                    "First option in submenu in submenu clicked"
                                ),
                        },
                        {
                            type: "leaf",
                            text: "Second option in submenu in submenu",
                            callback: () =>
                                console.log(
                                    "Second option in submenu in submenu clicked"
                                ),
                        },
                    ],
                },

                {
                    type: "leaf",
                    text: "Second option in submenu",
                    callback: () =>
                        console.log("Second option in submenu clicked"),
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
</script>

    <GenericContextMenu items={options} bind:this={menu} />

<div
    class="container"
    style="width:{overlayWidth}px; height:{overlayHeight}px"
    on:dblclick={resetRange}
    use:rightMouseClick={(e) => {
        menu.open({ x: e.pageX, y: e.pageY });
    }}
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
