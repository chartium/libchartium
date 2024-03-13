<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../utils/GenericTooltip.svelte";
  import type { Point } from "../types.js";
  import { globalMouseMove } from "../utils/mouseActions.js";
  import type { TraceInfo } from "../data-worker/trace-list.js";
  import TracePreview from "./TracePreview.svelte";

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

  export let previewStyle: "simplified" | "full";

  export let show: boolean;

  let position: Point;

  function repairedPosition(
    positionRelativeToPage: Point,
    forbiddenRectangle:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
        }
      | undefined,
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
      forbiddenRectangle,
    );
  }
</script>

<div use:globalMouseMove={updateMousePosition}>
  <GenericTooltip position={show ? position : undefined}>
    <div class="tooltip-container">
      {#if singleTraceInfo !== undefined}
        <div class="header" style:font-weight="500">
          <TracePreview
            previewedTrace={singleTraceInfo.styledTrace}
            simplified={previewStyle === "simplified"}
          />
          {singleTraceInfo.styledTrace.label ?? singleTraceInfo.styledTrace.id}
        </div>
        {#each Object.entries(singleTraceInfo) as [key, value]}
          {#if key !== "styledTrace"}
            {@const keyToShow =
              key === "x" ? "date" : key === "y" ? "value" : key}
            <div
              class="trace-info"
              style:line-height="17px"
              style:font-size="14px"
            >
              <div class="value-name">{keyToShow}:</div>
              <div class="value-value">
                {value}
              </div>
            </div>
          {/if}
        {/each}
      {:else}
        {@const first = nearestTracesInfo[0]}

        <div class="header">
          {first?.x}
        </div>
        {#each nearestTracesInfo as info}
          <div class="trace-info">
            <div class="value-name" style:font-weight="500">
              <TracePreview
                previewedTrace={info.styledTrace}
                simplified={previewStyle === "simplified"}
              />
              {info.styledTrace.label ?? info.styledTrace.id}
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
    background-color: var(--libchartium-secondary-background);
    margin: 1em 3em;
    padding: 0.5em;
    border-radius: 0.5em;
  }

  .header {
    font-size: larger;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-evenly;
    padding-left: 20px;
    padding-right: 20px;
    margin-bottom: 5px;
  }

  .trace-info {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .value-name {
    display: flex;
    flex-direction: row;
    padding-left: 4px;
    padding-right: 4px;
  }

  .value-value {
    padding-left: 4px;
    padding-right: 4px;
  }
</style>
