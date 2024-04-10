<script lang="ts">
  import { onMount, tick } from "svelte";

  import type { TraceList } from "../data-worker/trace-list.js";
  import * as canvas from "./canvas.js";
  import { map } from "../utils/collection.js";
  import type { WritableSignal } from "@mod.js/signals";
  import LegendEntry from "./LegendEntry.svelte";
  import type { OrUnset } from "../../../dist/wasm/libchartium.js";

  export let numberOfShownTraces: number = 5;

  export let previewStyle: "simplified" | "full";

  export let traces: TraceList;
  $: allIds = [...traces.traces()];

  $: tracesWithStyles = allIds.map((traceId) => {
    const style = traces.getStyle(traceId);
    return {
      traceId,
      label: traces.getLabel(traceId),
      width: withDefault(style["line-width"], 2),
      color: traces.getColor(traceId),
      showPoints: style["points"] === "show",
    };
  });

  const withDefault = <T,>(value: OrUnset<T>, def: T): T =>
    value === "unset" ? def : value;

  export let hiddenTraceIds: WritableSignal<Set<string>>;

  let canvasRefs: HTMLCanvasElement[] = [];

  let container: HTMLElement; // FIXME this is a lame workaround for the @container css query which for some reason (??) doesn't work in svelte altho the github issue says it is closed
  let wide = false;
  onMount(() => {
    tick().then(() => {
      if (container.clientWidth > 300) {
        // FIXME delet when @container
        wide = true;
      }
    });

    for (const [index, canvasRef] of canvasRefs.entries()) {
      const color = tracesWithStyles[index].color;
      const width = tracesWithStyles[index].width;
      const points = tracesWithStyles[index].showPoints;

      const ctx = canvasRef.getContext("2d");
      if (!ctx) {
        continue;
      }

      const style: canvas.DrawStyle = {
        fillStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
        strokeStyle: `rgb( ${color[0]}, ${color[1]}, ${color[2]} ) `,
        lineWidth: width,
      };

      if (points) {
        canvas.drawCircle(ctx, [previewSize - width, width], width, style);
        canvas.drawCircle(
          ctx,
          [previewSize / 2, previewSize / 2],
          width,
          style,
        );
        canvas.drawCircle(ctx, [width, previewSize - width], width, style);
      } else {
        canvas.drawSegment(ctx, [0, previewSize], [previewSize, 0], style);
      }
    }
  });

  /** Width and height of the lil preview window */
  const previewSize = 20;

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
    bind:this={container}
    style:width={`min(${(widestLegend + 3) * numberOfShownTraces}px, 100%)`}
    style:flex-direction={wide ? "row" : "column"}
    style:grid-template-columns={`repeat(auto-fill, minmax(${widestLegend}px, 1fr))`}
  >
    <!--
  {#each {length: numberOfShownTraces} as _, i} <!-- a lil trick ti break after numberOfShownTraces - ->
  {@const styledTrace = tracesWithStyles[i]}
-->
    {#each tracesWithStyles.slice(0, numberOfShownTraces) as styledTrace}
      {@const hidden = $hiddenTraceIds.has(styledTrace.traceId)}
      <LegendEntry
        {hidden}
        {previewSize}
        {previewStyle}
        {styledTrace}
        {updateMaxWidth}
        updateHiddenTraceIds={hiddenTraceIds.update}
        {allIds}
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
