<script lang="ts">
  import type { CloseTrace } from "../../state/interactive/hover.js";
  import type { ChartValue, DisplayUnit } from "../../types.js";
  import { formatChartValue } from "../../units/mod.js";
  import TracePreview from "../TracePreview.svelte";

  export let previewStyle: "simplified" | "full";
  export let hoverX: ChartValue;
  export let nearestTraces: CloseTrace[];
  export let xDisplayUnit: DisplayUnit;
  export let yDisplayUnit: DisplayUnit;
  export let decimalPlaces: number = 3;
</script>

<div class="tooltip-container">
  <div class="header">
    {formatChartValue(hoverX, { unit: xDisplayUnit })}
  </div>
  {#each nearestTraces as trace}
    <div class="trace-info">
      <div class="trace-name">
        <TracePreview
          traceStyle={trace.style}
          simplified={previewStyle === "simplified"}
        />
        {trace.style.label ?? trace.traceId}
      </div>
      <div class="trace-value">
        {formatChartValue(trace.y, { unit: yDisplayUnit, decimalPlaces })}
      </div>
    </div>
  {/each}
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

  .trace-name {
    display: flex;
    flex-direction: row;
    padding-left: 4px;
    padding-right: 4px;
    font-weight: bold;
  }

  .trace-value {
    padding-left: 4px;
    padding-right: 4px;
  }
</style>
