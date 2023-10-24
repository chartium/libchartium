<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../GenericTooltip.svelte";
  import type { Point, Quantity, Range } from "../types.js";
  import { globalMouseMove } from "../utils/mouseGestures.js";
  import type { TraceInfo } from "../data-worker/trace-list.js";
  import TracePreview from "./TracePreview.svelte";
  import dayjs from "dayjs";

  /** The tooltip will try its best to not be in this rectangle */
  export let forbiddenRectangle:
    | { x: number; y: number; width: number; height: number }
    | undefined = undefined;

  export let nearestTracesInfo: {
    styledTrace: TraceInfo;
    x: Quantity | dayjs.Dayjs | number;
    y: Quantity | dayjs.Dayjs | number;
  }[];
  export let singleTraceInfo:
    | {
        styledTrace: TraceInfo;
        x: Quantity | dayjs.Dayjs | number;
        y: Quantity | dayjs.Dayjs | number;
        min: Quantity | dayjs.Dayjs | number;
        max: Quantity | dayjs.Dayjs | number;
        avg: Quantity | dayjs.Dayjs | number;
      }
    | undefined;

  export let show: boolean;

  let position: Point;

  let boundingDiv: HTMLDivElement;

  const dateFormat = "MMM DD YYYY, hh:mm:ss";

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

<div use:globalMouseMove={updateMousePosition} bind:this={boundingDiv}>
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
                {dayjs.isDayjs(value)
                  ? value.format(dateFormat)
                  : value.toString()}
              </div>
            </div>
          {/if}
        {/each}
      {:else}
        {@const first = nearestTracesInfo[0]}

        <div class="header">
          x: {dayjs.isDayjs(first?.x)
            ? first.x.format(dateFormat)
            : first?.x.toString()}
        </div>
        {#each nearestTracesInfo as info}
          <div class="trace-info">
            <div class="value-name">
              <TracePreview previewedTrace={info.styledTrace} />
              {info.styledTrace.id}:
            </div>
            <div class="value-value">
              {dayjs.isDayjs(info.y)
                ? info.y.format(dateFormat)
                : info.y.toString()}
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
    background-color: rgb(51, 51, 51);
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
