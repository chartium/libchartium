<script lang="ts">
  import type { HoveredTrace } from "../../state/interactive/hover.js";
  import type { DisplayUnit } from "../../types.js";
  import { DateFormat } from "../../utils/dateFormat.js";
  import { uniqueDecimals } from "../../utils/format.js";
  import { NumericDateRepresentation } from "../../utils/numericDateRepresentation.js";
  import { formatChartValue, toNumeric } from "../../units/mod.js";
  import TracePreview from "../TracePreview.svelte";

  export let previewStyle: "simplified" | "full";

  export let hoveredTrace: HoveredTrace;
  export let xDisplayUnit: DisplayUnit;
  export let yDisplayUnit: DisplayUnit;
  export let decimalPlaces: number = 3;

  $: traceMetas = {
    value: hoveredTrace.y,
    min: hoveredTrace.statistics.min,
    max: hoveredTrace.statistics.max,
    avg: hoveredTrace.statistics.average,
  };
</script>

<div class="tooltip-container">
  <div class="header">
    <TracePreview
      traceStyle={hoveredTrace.style}
      simplified={previewStyle === "simplified"}
    />
    {hoveredTrace.style.label ?? hoveredTrace.traceId}
  </div>
  <div class="trace-info">
    <div class="value-name">date:</div>
    <div class="value-value">
      {formatChartValue(hoveredTrace.x, { unit: xDisplayUnit })}
    </div>
  </div>

  <div style:margin-bottom={"9px"} />
  {#each Object.entries(traceMetas) as [key, value]}
    <div class="trace-info">
      <div class="value-name">{key}:</div>
      <div class="value-value">
        {formatChartValue(value, { unit: yDisplayUnit, decimalPlaces })}
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
    font-size: 17px;
    font-weight: bold;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding-left: 20px;
    padding-right: 20px;
    margin-bottom: 5px;
  }

  .trace-info {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    font-size: 14px;
    line-height: 17px;
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
