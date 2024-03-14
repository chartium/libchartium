<script lang="ts">
  import TracePreview from "../TracePreview.svelte";
  import type { TraceInfo } from "../../data-worker/trace-list.js";

  export let previewStyle: "simplified" | "full";
  export let singleTraceInfo: {
    styledTrace: TraceInfo;
    x: string;
    y: string;
    min: string;
    max: string;
    avg: string;
  };
  let traceMetas: Record<string, string>;
  let y: string;
  $: ({ x, y, styledTrace, ...traceMetas } = singleTraceInfo);
  $: traceMetas = { value: y, ...traceMetas };
</script>

<div class="tooltip-container">
  <div class="header">
    <TracePreview
      previewedTrace={singleTraceInfo.styledTrace}
      simplified={previewStyle === "simplified"}
    />
    {singleTraceInfo.styledTrace.label ?? singleTraceInfo.styledTrace.id}
  </div>
  <div class="trace-info">
    <div class="value-name">date:</div>
    <div class="value-value">{singleTraceInfo.x}</div>
  </div>

  <div style:margin-bottom={"9px"} />
  {#each Object.entries(traceMetas) as [key, value]}
    <div class="trace-info">
      <div class="value-name">{key}:</div>
      <div class="value-value">
        {value}
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
