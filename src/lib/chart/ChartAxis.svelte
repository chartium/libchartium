<!-- Component creating both the X and Y axis -->

<script lang="ts">
    import { onMount } from "svelte";
    import { leftMouseDrag } from "../../utils/mouseGestures";
    import type { MouseDragCallbacks } from "../../utils/mouseGestures";
    import * as canvas from "./canvas.ts";

    export let label: string;
    export let axisHeight: number;
    export let axisWidth: number;
    export let axis: "x" | "y";
    export let ticks: { pos: number; value: number }[];

    let canvasRef: HTMLCanvasElement;

    let ctx: CanvasRenderingContext2D;

    onMount(() => {
        ctx = canvasRef.getContext("2d")!; // TODO is it a good idea to use non-null assertion here?
        ctx.fillStyle = "black"; // FIXME DEBUG
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
    });

    let downPosition: [number, number] | undefined;
    let movePosition: [number, number] | undefined;

    function redrawInterval() {
        if (!downPosition || !movePosition) return;
        ctx.clearRect(0, 0, axisWidth, axisHeight);

        canvas.drawSegment(
            ctx,
            axis === "y"
                ? [0, downPosition[1] - ctx.lineWidth / 2]
                : [downPosition[0] - ctx.lineWidth / 2, 0],
            axis === "y"
                ? [axisWidth, downPosition[1] - ctx.lineWidth / 2]
                : [downPosition[0] - ctx.lineWidth / 2, axisHeight]
        );

        canvas.drawSegment(
            ctx,
            axis === "y"
                ? [0, movePosition[1] - ctx.lineWidth / 2]
                : [movePosition[0] - ctx.lineWidth / 2, 0],
            axis === "y"
                ? [axisWidth, movePosition[1] - ctx.lineWidth / 2]
                : [movePosition[0] - ctx.lineWidth / 2, axisHeight]
        );
    }

    function getAxisValueFromPosition(position: [number, number]) {
        const longwisePosition = axis === "x" ? position[0] : position[1];
        const alongAxis =
            axis === "x"
                ? longwisePosition / axisWidth
                : 1 - longwisePosition / axisHeight;
        return alongAxis * ticks[ticks.length - 1].value;
    }

    const dragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            downPosition = [e.offsetX, e.offsetY];
            console.log(
                "Down position",
                getAxisValueFromPosition(downPosition)
            );
        },
        move: (e) => {
            movePosition = [e.offsetX, e.offsetY];
            redrawInterval();
        },
        end: (e) => {
            console.log("Up position", getAxisValueFromPosition(movePosition!));
            downPosition = undefined;
            movePosition = undefined;
            ctx.clearRect(0, 0, axisWidth, axisHeight);
        },
    };
</script>

<div
    class="container"
    style={axis === "x"
        ? "flex-direction: column"
        : "flex-direction: row-reverse "}
    style:height="{axisHeight}px"
    style:width="{axisWidth}px"
>
    <canvas bind:this={canvasRef} width={axisWidth} height={axisHeight} />
    <div
        class="{axis} ticks-and-label"
        use:leftMouseDrag={dragCallbacks}
        style:height="{axisHeight}px"
        style:width="{axisWidth}px"
        style={axis === "y"
            ? "flex-direction: column-reverse"
            : "flex-direction: column"}
    >
        <div class="ticks">
            {#each ticks as tick}
                <span
                    style={axis === "x"
                        ? "left: {tick.pos}*100%"
                        : "top: {tick.pos}*100%"}>{tick.value}</span
                >
            {/each}
        </div>
        <h3 class={axis}>{label}</h3>
    </div>
</div>

<style>
    .container {
        position: relative;
        display: flex;
    }
    h3 {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        user-select: none;
        pointer-events: none;
        margin: 0;
    }
    .ticks-and-label {
        display: flex;
        align-items: stretch;
        position: absolute;
        top: 0;
        left: 0;
    }
    .ticks {
        position: relative;
        flex: 1;
        user-select: none;
        pointer-events: none;
    }
    .y {
        writing-mode: sideways-lr;
        flex-direction: column-reverse;
    }

    .x {
        writing-mode: horizontal-tb;
    }
    span {
        pointer-events: none;
        user-select: none;
        display: inline-block;
        text-align: center;
    }
    div {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
</style>
