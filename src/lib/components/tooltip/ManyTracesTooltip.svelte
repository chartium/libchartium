<script lang="ts">
  import TracePreview from "../TracePreview.svelte";

  export let previewStyle: "simplified" | "full";
  export let nearestTracesInfo: {
    traceId: string;
    label: string | undefined;
    color: string;
    width: number;
    showPoints: boolean;
    x: string;
    y: string;
  }[];
  $: first = nearestTracesInfo[0];
</script>

<div class="tooltip-container">
  <div class="header">
    {first?.x}
  </div>
  {#each nearestTracesInfo as info}
    <div class="trace-info">
      <div class="trace-name">
        <TracePreview
          previewedTrace={info}
          simplified={previewStyle === "simplified"}
        />
        {info.label ?? info.traceId}
      </div>
      <div class="trace-value">
        {info.y}
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
