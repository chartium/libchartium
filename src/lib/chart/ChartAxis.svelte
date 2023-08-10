<!-- Component creating both the X and Y axis -->

<script lang="ts">
    import { leftMouseDrag } from "../../utils/mouseGestures";
    import type { MouseDragCallbacks } from "../../utils/mouseGestures";
    import type { Range } from "../types";

    /** Label to be displayed next to the axis */
    export let label: string;
    /** The height of the axis */
    export let axisHeight: number;
    /** The width of the axis */
    export let axisWidth: number;
    /** Whether the axis is for x or y. Determines label orientation and selection positions */
    export let axis: "x" | "y";
    /** Ticks on the axis. Position is to be between 0 and 1 */
    export let ticks: { pos: number; value: number }[];

    export let zoomOrMove: "zoom" | "move" | "neither" = "neither";

    /** Coordinate of where dragging and ended for this axis */
    export let movePosition: Range | undefined;
    /** Value of where dragging started and ended. Linearly interpolated from ticks */
    export let moveValue: Range | undefined;

    $: { // FIXME this should prolly be in chart and the axis should only return values for the positions
        if (zoomOrMove === "move" && movePosition !== undefined) {
            const delta =
                getAxisValueFromPosition(movePosition.from) -
                getAxisValueFromPosition(movePosition.to);
            const min = ticks[0].value;
            const max = (ticks.at(-1) ?? ticks[0]).value;
            moveValue = {from: min+delta, to: max+delta};
            zoomOrMove = "move";
        }
        if (zoomOrMove === "zoom" && movePosition !== undefined) {
            const from = getAxisValueFromPosition(movePosition.from);
            const to = getAxisValueFromPosition(movePosition.to);
            moveValue = {from, to};
            zoomOrMove = "zoom";
        }
    }

    /** linearly interpolates value from coordinate along this axis */
    function getAxisValueFromPosition(positionCoordinate: number) {
        const alongAxis =
            axis === "x"
                ? positionCoordinate / axisWidth
                : 1 - positionCoordinate / axisHeight;
        return (
            alongAxis * ((ticks.at(-1) ?? ticks[0]).value - ticks[0].value) +
            ticks[0].value
        );
        // TODO: this is linear interpolation. For more complicated graphs this has to be overhauled
    }

    const dragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            movePosition =
                axis === "x" ? {from: e.offsetX, to: e.offsetX} : {from: e.offsetY, to: e.offsetY};
        },
        move: (e) => {
            movePosition!.to = axis === "x" ? e.offsetX : e.offsetY;
        },
        end: (e) => {
            // FIXME Callbacks for moving the axis
            movePosition = undefined;
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
        align-items: stretch;
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
