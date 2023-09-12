<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../GenericTooltip.svelte";
  import type { Point } from "../types";
  import { globalMouseMove } from "../../utils/mouseGestures";
  import type { TraceInfo } from "../data-worker/trace-list";
  import TracePreview from "./TracePreview.svelte";

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

  function updateMousePosition(event: MouseEvent) {
    position = { x: event.clientX, y: event.clientY };
  }
</script>

<div use:globalMouseMove={updateMousePosition}>
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
        <div class="header">
          x: {nearestTracesInfo[0]?.x}
        </div>
        {#each nearestTracesInfo as trace}
          <div class="trace-info">
            <div class="value-name">
              <TracePreview previewedTrace={trace.styledTrace} />
              {trace.styledTrace.id}:
            </div>
            <div class="value-value">
              {trace.y}
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
