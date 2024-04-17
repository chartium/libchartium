<script lang="ts">
  import TracePreview from "./TracePreview.svelte";
  import { singleOrDoubleclick } from "../utils/mouseActions.js";
  import type { ComputedTraceStyle } from "../data-worker/trace-list.js";

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
  style:opacity={hidden ? "0.5" : 1}
  use:singleOrDoubleclick={{
    single: () => toggleTraceVisibility(traceId),
    double: () => toggleVisibilityOfAllTraces(traceId),
  }}
  role="presentation"
>
  <div class="trace-preview" class:simplified={previewStyle === "simplified"}>
    <TracePreview
      {traceStyle}
      previewHeight={previewSize}
      previewWidth={previewSize}
      simplified={previewStyle === "simplified"}
    />
  </div>
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
</style>
