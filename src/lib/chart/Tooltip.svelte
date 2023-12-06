<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../GenericTooltip.svelte";
  import type { Point } from "../types.js";
  import { globalMouseMove } from "../utils/mouseGestures.js";
  import type { TraceInfo } from "../data-worker/trace-list.js";
  import TracePreview from "./TracePreview.svelte";
  import { portal } from "svelte-portal";

  /** The tooltip will try its best to not be in this rectangle */
  export let forbiddenRectangle:
    | { x: number; y: number; width: number; height: number }
    | undefined = undefined;

  export let nearestTracesInfo: {
    styledTrace: TraceInfo;
    x: string;
    y: string;
  }[];
  export let singleTraceInfo:
    | {
        styledTrace: TraceInfo;
        x: string;
        y: string;
        min: string;
        max: string;
        avg: string;
      }
    | undefined;

  export let show: boolean;

  let position: Point;

  let boundingDiv: HTMLDivElement;

  function repairedPosition(
    positionRelativeToPage: Point,
    forbiddenRectangle:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
        }
      | undefined
  ): Point {
    if (forbiddenRectangle === undefined) {
      return positionRelativeToPage;
    }

    const tooltipXright = positionRelativeToPage.x;
    const tooltipYbottom = positionRelativeToPage.y;

    const forbiddenXright = forbiddenRectangle.x + forbiddenRectangle.width;
    const forbiddenYtop = forbiddenRectangle.y;

    if (tooltipYbottom > forbiddenYtop && tooltipXright < forbiddenXright) {
      //in rect
      return {
        x: forbiddenXright,
        y: forbiddenYtop,
      };
    }

    return positionRelativeToPage;
  }

  function updateMousePosition(event: MouseEvent) {
    position = repairedPosition(
      { x: event.clientX, y: event.clientY },
      forbiddenRectangle
    );
  }
</script>

<div
  use:portal
  use:globalMouseMove={updateMousePosition}
  bind:this={boundingDiv}
>
  <GenericTooltip position={show ? position : undefined}>
    <div class="tooltip-container">
      {#if singleTraceInfo !== undefined}
        <div class="header">
          <TracePreview previewedTrace={singleTraceInfo.styledTrace} />
          {singleTraceInfo.styledTrace.id}
        </div>
        {#each Object.entries(singleTraceInfo) as [key, value]}
          {#if key !== "styledTrace"}
            <div class="trace-info">
              <div class="value-name">{key}:</div>
              <div class="value-value">
                {value}
              </div>
            </div>
          {/if}
        {/each}
      {:else}
        {@const first = nearestTracesInfo[0]}

        <div class="header">
          x: {first?.x}
        </div>
        {#each nearestTracesInfo as info}
          <div class="trace-info">
            <div class="value-name">
              <TracePreview previewedTrace={info.styledTrace} />
              {info.styledTrace.id}:
            </div>
            <div class="value-value">
              {info.y}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </GenericTooltip>
</div>

<style>
  .tooltip-container {
    display: flex;
    flex-direction: column;
    background-color: var(--secondary-background);
    margin: 5px;
  }

  .header {
    font-size: larger;
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    padding-left: 20px;
    padding-right: 20px;
    margin-bottom: 5px;
    margin-top: 5px;
  }

  .trace-info {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .value-name {
    display: flex;
    flex-direction: row;
    font-weight: 600;
    padding-left: 4px;
    padding-right: 4px;
  }

  .value-value {
    padding-left: 4px;
    padding-right: 4px;
  }
</style>
