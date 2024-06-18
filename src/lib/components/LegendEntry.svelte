<script lang="ts">
  import TracePreview from "./TracePreview.svelte";
  import { singleOrDoubleclick } from "../utils/mouseActions.js";
  import type { ComputedTraceStyle } from "../data/trace-list.js";

  export let traceId: string;
  export let traceStyle: ComputedTraceStyle;
  export let hidden: boolean;
  export let previewSize: number;
  export let previewStyle: "simplified" | "full";

  export let toggleTraceVisibility: (id: string) => void;
  export let toggleVisibilityOfAllTraces: (id: string) => void;
</script>

<div
  class="trace-legend"
  class:hidden
  on:click={() => (hidden = !hidden)}
  use:singleOrDoubleclick={{
    single: () => toggleTraceVisibility(traceId),
    double: () => toggleVisibilityOfAllTraces(traceId),
  }}
  role="presentation"
>
  <TracePreview
    {traceStyle}
    previewHeight={previewSize}
    previewWidth={previewSize}
    simplified={previewStyle === "simplified"}
  />
  {traceStyle.label ?? traceId}
</div>

<style>
  .trace-legend {
    user-select: none;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    text-wrap: nowrap;
    width: fit-content;
  }

  .hidden {
    opacity: 0.5;
  }
</style>
