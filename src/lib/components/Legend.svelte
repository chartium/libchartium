<script lang="ts">
  const PREVIEW_WIDTH = 15;
  const GAP = 3;
  const ROW_HEIGHT = 24;

  import LegendEntry from "./LegendEntry.svelte";

  import type { ComputedTraceStyle, TraceList } from "../data/trace-list.js";
  import type { WritableSignal } from "@typek/signalhead";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { measureText } from "../utils/format.js";
  import type { ChartStyleSheet } from "../state/core/style.js";

  export let numberOfShownTraces: number = 5;

  export let previewStyle: "simplified" | "full";

  export let traces: TraceList;
  $: allIds = [...traces.traces()];

  $: styledTraces = allIds.map((traceId) => ({
    traceId,
    style: traces.getStyle(traceId),
  }));

  $: shownTraces = styledTraces.slice(0, numberOfShownTraces);

  export let hiddenTraceIds: WritableSignal<Set<string>>;
  export let chartStylesheet: Partial<ChartStyleSheet> | undefined;

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

  let containerRect: DOMRectReadOnly | undefined;

  $: widestLegend = containerElem
    ? calculateWidestLegend(shownTraces)
    : PREVIEW_WIDTH + GAP;

  let containerElem: HTMLDivElement;
  const calculateWidestLegend = (
    traces: { traceId: string; style: ComputedTraceStyle }[],
  ) => {
    const max = traces.reduce<number>((prev, trace) => {
      return Math.max(
        prev,
        measureText(trace.style.label ?? trace.traceId, containerElem),
      );
    }, 0);

    return max + PREVIEW_WIDTH + GAP;
  };

  $: cols = containerRect
    ? Math.max(
        1,
        Math.floor((containerRect.width + GAP) / (widestLegend + GAP)),
      )
    : 1;

  $: needsVirtualizer = shownTraces.length >= cols;

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: Math.ceil(shownTraces.length / cols),
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => {
      return (containerElem?.parentElement ?? null) as HTMLDivElement | null;
    },
    overscan: 5,
    gap: GAP,
  });
</script>

{#if needsVirtualizer}
  <div
    class="legend-container"
    bind:this={containerElem}
    bind:contentRect={containerRect}
    style:height="{$virtualizer.getTotalSize()}px"
    style:min-width="max({widestLegend}px, 100px)"
    style:--row-height="{ROW_HEIGHT}px"
    style:--legend-gap="{GAP}px"
    style:--legend-cols={`repeat(${cols}, 1fr)`}
  >
    {#each $virtualizer.getVirtualItems() as row (row.index)}
      {@const windowStart = row.index * cols}
      <div
        class="legend-grid {chartStylesheet?.legend?.class ?? ''}"
        style:transform="translateY({row.start}px)"
        style={chartStylesheet?.legend?.style}
      >
        {#each shownTraces.slice(windowStart, windowStart + cols) as { traceId, style }}
          {@const hidden = $hiddenTraceIds.has(traceId)}
          <LegendEntry
            {hidden}
            previewSize={20}
            {previewStyle}
            {traceId}
            traceStyle={style}
            {toggleTraceVisibility}
            {toggleVisibilityOfAllTraces}
          />
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <div
    class="legend-container"
    bind:this={containerElem}
    bind:contentRect={containerRect}
    style:min-width="max({widestLegend}px, 100px)"
    style:--col-width="{widestLegend}px"
    style:--legend-gap="{GAP}px"
    style:--legend-cols={`repeat(${cols}, 1fr)`}
  >
    <div class="legend-flex">
      {#each shownTraces as { traceId, style }}
        {@const hidden = $hiddenTraceIds.has(traceId)}
        <LegendEntry
          {hidden}
          previewSize={20}
          {previewStyle}
          {traceId}
          traceStyle={style}
          {toggleTraceVisibility}
          {toggleVisibilityOfAllTraces}
        />
      {/each}
    </div>
  </div>
{/if}

<style lang="scss">
  .legend-grid {
    display: grid;
    overflow: hidden;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;

    grid-template-columns: var(--legend-cols);
    gap: var(--legend-gap);
    height: var(--row-height);
  }

  .legend-flex {
    display: flex;
    justify-content: center;
    gap: var(--legend-gap);

    :global(> div) {
      width: var(--col-width);
    }
  }

  .legend-container {
    position: relative;
    width: 100%;
  }
</style>
