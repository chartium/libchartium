<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../GenericTooltip.svelte";
  import type { Point } from "../types";
  import { globalMouseMove } from "../../utils/mouseGestures";

  export let nearestTracesInfo: { traceId: string; x: string; y: string }[];
  export let singleTraceInfo:
    | {
        traceId: string;
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
          {singleTraceInfo.traceId}
        </div>
        {#each Object.entries(singleTraceInfo) as [key, value]}
          {#if key !== "traceId"}
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
              {trace.traceId}:
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
    background-color: grey;
    margin: 5px;
  }

  .header {
    font-size: larger;
    margin-bottom: 5px;
  }

  .trace-info {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .value-name {
    font-weight: 600;
    padding-left: 4px;
    padding-right: 4px;
  }

  .value-value {
    padding-left: 4px;
    padding-right: 4px;
  }
</style>
