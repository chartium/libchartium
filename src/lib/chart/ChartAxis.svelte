<!-- Component creating both the X and Y axis -->

<script lang="ts">
    import { leftMouseDrag } from "../../utils/mouseGestures";
    import type { MouseDragCallbacks } from "../../utils/mouseGestures";

    export let label: string;
    export let axisHeight: number;
    export let axisWidth: number;
    export let axis: "x" | "y";
    export let ticks: number[];

    const dragCallbacks: MouseDragCallbacks = {
        start: (e) => {
            console.log(`drag start on axis ${axis} at `, e.x, e.y);
        },
        move: (e) => {
            console.log("dragging");
        },
        end: (e) => {
            console.log(`drag end on axis ${axis} at `, e.x, e.y);
        },
    };
</script>

<div class="{axis} ticks-and-label">
    <div
        class="ticks"
        use:leftMouseDrag={dragCallbacks}
        style="width: {axisWidth}px; height: {axisHeight}px"
    >
        {#each ticks as tick}
            <span>{tick}</span>
        {/each}
    </div>
    <h3 class={axis}>{label}</h3>
</div>

<style>
    .ticks-and-label {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
    }
    .ticks {
        display: flex;
        justify-content: space-between;
        align-items: center;
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
