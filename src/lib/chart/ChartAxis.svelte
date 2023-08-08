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
    export let ticks: number[];

    let canvasRef: HTMLCanvasElement;

    let ctx: CanvasRenderingContext2D;

    onMount(() => {
        ctx = canvasRef.getContext("2d")!; // TODO is it a good idea to use non-null assertion here?
        ctx.fillStyle = "black"; // FIXME DEBUG
        ctx.strokeStyle = "black";
        ctx.lineWidth = 10;
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

    const dragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            downPosition = [e.offsetX, e.offsetY];
        },
        move: (e) => {
            movePosition = [e.offsetX, e.offsetY];
            redrawInterval();
        },
        end: (e) => {
            downPosition = undefined;
            movePosition = undefined;
            ctx.clearRect(0, 0, axisWidth, axisHeight);
        },
    };
</script>

<div
    class="{axis} ticks-and-label"
    style="width: {axisWidth}px; height: {axisHeight}px;"
>
    <canvas bind:this={canvasRef} width={axisWidth} height={axisHeight} />
    <div
        class="ticks"
        use:leftMouseDrag={dragCallbacks}
        style="width: {axisWidth}px; height: {axisHeight}px;"
    >
        {#each ticks as tick}
            <span>{tick}</span>
        {/each}
    </div>
    <h3 class={axis}>{label}</h3>
</div>

<style>
    .ticks-and-label {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
    }
    .ticks {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
    }
    .y {
        writing-mode: sideways-lr;
        flex-direction: column-reverse;
    }

    .x {
        writing-mode: horizontal-tb;
    }
    h3 {
        margin: 5px;
        user-select: none;
        height: fit-content;
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
