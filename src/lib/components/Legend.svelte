<script lang="ts">
  import LegendEntry from "./LegendEntry.svelte";

  import type { TraceList } from "../data-worker/trace-list.js";
  import type { WritableSignal } from "@mod.js/signals";

  export let numberOfShownTraces: number = 5;

  export let previewStyle: "simplified" | "full";

  export let traces: TraceList;
  $: allIds = [...traces.traces()];

  $: styledTraces = allIds.map((traceId) => ({
    traceId,
    style: traces.getStyle(traceId),
  }));

  export let hiddenTraceIds: WritableSignal<Set<string>>;

  const toggleTraceVisibility = (id: string) => {
    hiddenTraceIds.update((hidden) => {
      if (hidden.has(id)) {
        hidden.delete(id);
      } else {
        hidden.add(id);
      }
      return hidden;
    });
  };

  /**
   * If all traces are visible, hide all except for
   * the selected one; else show all traces.
   */
  const toggleVisibilityOfAllTraces = (id: string) => {
    hiddenTraceIds.update((hidden) => {
      if (hidden.size === 0 || (hidden.size === 1 && hidden.has(id))) {
        hidden = new Set(traces.traces());
        hidden.delete(id);
      } else {
        hidden.clear();
      }
      return hidden;
    });
  };

  // FIXME workaround for @container css query
  let containerRect: DOMRectReadOnly | undefined;
  $: wide = (containerRect?.width ?? 0) > 300;

  let widestLegend: number = 0;
  const updateMaxWidth = (width: number) => {
    if (width > widestLegend) {
      widestLegend = width;
    }
  };
</script>

<div class="legend-container">
  <div
    class="legend-grid"
    bind:contentRect={containerRect}
    style:width={`min(${(widestLegend + 3) * numberOfShownTraces}px, 100%)`}
    style:flex-direction={wide ? "row" : "column"}
    style:grid-template-columns={`repeat(auto-fill, minmax(${widestLegend}px, 1fr))`}
  >
    {#each styledTraces.slice(0, numberOfShownTraces) as { traceId, style }}
      {@const hidden = $hiddenTraceIds.has(traceId)}
      <LegendEntry
        {hidden}
        previewSize={20}
        {previewStyle}
        {traceId}
        traceStyle={style}
        {updateMaxWidth}
        {toggleTraceVisibility}
        {toggleVisibilityOfAllTraces}
      />
    {/each}
  </div>
</div>

<style lang="scss">
  .legend-grid {
    display: grid;
    gap: 3px;
    margin: 0.5rem;
    overflow-y: auto;
  }
  .legend-container {
    display: flex;
    justify-content: center;
    width: 100%;
  }
</style>
