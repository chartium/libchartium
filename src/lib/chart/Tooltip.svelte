<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import GenericTooltip from "../GenericTooltip.svelte";
  import type { Point } from "../types";
  import { globalMouseMove } from "../../utils/mouseGestures";

  export let header: any;
  export let traceInfo: { traceId: string; value: string }[];

  export let show: boolean;

  let position: Point;

  function updateMousePosition(event: MouseEvent) {
    position = { x: event.clientX, y: event.clientY };
  }
</script>

<div use:globalMouseMove={updateMousePosition}>
  <GenericTooltip position={show ? position : undefined}>
    <div class="tooltip-container">
      <div class="header">
        {header}
      </div>
      {#each traceInfo as trace}
        <div class="trace-info">
          <div class="trace-id">{trace.traceId}:</div>
          <div class="trace-value">
            {trace.value}
          </div>
        </div>
      {/each}
    </div>
  </GenericTooltip>
</div>

<style>
  .tooltip-container {
    display: flex;
    flex-direction: column;
    background-color: grey;
    margin: 5px
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

  .trace-id {
    font-weight: 600;
    padding-left: 4px;
    padding-right: 4px;
  }

  .trace-value {
    padding-left: 4px;
    padding-right: 4px;
  }
</style>
