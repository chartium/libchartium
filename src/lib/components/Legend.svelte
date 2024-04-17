<script lang="ts">
  import LegendEntry from "./LegendEntry.svelte";

  import type {
    ComputedTraceStyle,
    TraceList,
  } from "../data-worker/trace-list.js";
  import type { WritableSignal } from "@mod.js/signals";

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

  $: widestLegend = gridElem ? calculateWidestLegend(shownTraces) : 23;

  let calcCanvas: HTMLCanvasElement;
  let gridElem: HTMLDivElement;
  const calculateWidestLegend = (
    traces: { traceId: string; style: ComputedTraceStyle }[],
  ) => {
    if (!calcCanvas) {
      calcCanvas = document.createElement("canvas");
    }

    console.time("width");

    const ctx = calcCanvas.getContext("2d")!;
    const style = gridElem.computedStyleMap();

    // TODO: make sure the style is complete
    ctx.font = `${style.get("font-size")} ${style.get("font-family")}`;

    const max = traces.reduce<number>((prev, trace) => {
      return Math.max(
        prev,
        ctx.measureText(trace.style.label ?? trace.traceId).width,
      );
    }, 0);

    console.timeEnd("width");

    return max + 20 + 3;
  };
</script>

<div class="legend-container">
  <div
    class="legend-grid"
    bind:contentRect={containerRect}
    bind:this={gridElem}
    style:width={`min(${(widestLegend + 3) * numberOfShownTraces}px, 100%)`}
    style:flex-direction={wide ? "row" : "column"}
    style:grid-template-columns={`repeat(auto-fill, minmax(${widestLegend}px, 1fr))`}
  >
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
