<!-- Component creating both the X and Y axis -->

<script lang="ts">
    import { leftMouseDrag } from "../../utils/mouseGestures";
    import type { MouseDragCallbacks } from "../../utils/mouseGestures";
    import type { Range, Tick } from "../types";

    /** Label to be displayed next to the axis */
    export let label: string;
    /** The height of the axis */
    export let axisHeight: number;
    /** The width of the axis */
    export let axisWidth: number;
    /** Whether the axis is for x or y. Determines label orientation and selection positions */
    export let axis: "x" | "y";
    /** Ticks on the axis. Position is to be between 0 and 1 */
    export let ticks: Tick[];
    /** Offset of the axis from the top or left of the chart */
    export let axisOffset: number;

    export let zoomOrMove: "zoom" | "move" | "neither" = "neither";

    /** Coordinate of where dragging and ended for this axis */
    export let transformPosition: Range | undefined;
    /** Value of where dragging started and ended. Linearly interpolated from ticks */
    export let transformValue: Range | undefined;
    /** Call Chart's change range */
    export let updateRange: () => void;

    $: {
        // FIXME this should prolly be in chart and the axis should only return values for the positions
        if (
            zoomOrMove === "move" &&
            transformPosition !== undefined &&
            transformPosition.from !== transformPosition.to
        ) {
            const delta =
                getAxisValueFromPosition(transformPosition.from) -
                getAxisValueFromPosition(transformPosition.to);
            const min = ticks[0].value;
            const max = (ticks.at(-1) ?? ticks[0]).value;
            transformValue = { from: min + delta, to: max + delta };
            zoomOrMove = "move";
        }
        if (
            zoomOrMove === "zoom" &&
            transformPosition !== undefined &&
            transformPosition.from !== transformPosition.to
        ) {
            const from = getAxisValueFromPosition(transformPosition.from);
            const to = getAxisValueFromPosition(transformPosition.to);
            transformValue = { from, to };
            zoomOrMove = "zoom";
        }
    }

    /** linearly interpolates value from coordinate along this axis */
    function getAxisValueFromPosition(positionCoordinate: number) {
        const alongAxis =
            axis === "x"
                ? (positionCoordinate - axisOffset) / axisWidth
                : 1 - positionCoordinate / axisHeight;
        return (
            alongAxis * ((ticks.at(-1) ?? ticks[0]).value - ticks[0].value) +
            ticks[0].value
        );
        // TODO: this is linear interpolation. For more complicated graphs this has to be overhauled
    }

    const dragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            transformPosition =
                axis === "x"
                    ? {
                          from: e.offsetX + axisOffset,
                          to: e.offsetX + axisOffset,
                      }
                    : { from: e.offsetY, to: e.offsetY };
        },
        move: (e) => {
            zoomOrMove = "move";
            transformPosition!.to =
                axis === "x" ? e.offsetX + axisOffset : e.offsetY;
        },
        end: (e) => {
            updateRange();
            zoomOrMove = "neither";
            transformPosition = undefined;
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
        <!-- tooltip -->
        {#if transformPosition !== undefined && transformPosition.from !== transformPosition.to}
            {#if axis === "x"}
                <div
                    class="tooltip"
                    style:left="{transformPosition.from - axisOffset}px"
                >
                    {transformValue?.from.toFixed(3)}
                </div>
                <div
                    class="tooltip"
                    style:left="{transformPosition.to - axisOffset}px"
                >
                    {transformValue?.to.toFixed(3)}
                </div>
            {:else}
                <div
                    class="tooltip"
                    style:top="{transformPosition.from - axisOffset}px"
                >
                    {transformValue?.from.toFixed(3)}
                </div>
                <div
                    class="tooltip"
                    style:top="{transformPosition.to - axisOffset}px"
                >
                    {transformValue?.to.toFixed(3)}
                </div>
            {/if}
        {/if}

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
        position: relative;
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
    .tooltip {
        user-select: none;
        pointer-events: none;
        position: absolute;
    }
</style>
