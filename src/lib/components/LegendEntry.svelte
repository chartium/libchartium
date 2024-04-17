<script lang="ts">
  import { onMount } from "svelte";
  import TracePreview from "./TracePreview.svelte";
  import { oneOrDoubleclick } from "../utils/mouseActions.js";
  import { observeClientSize } from "../utils/actions.js";

  export let styledTrace: {
    traceId: string;
    label: string | undefined;
    color: string;
    width: number;
    showPoints: boolean;
  };
  export let updateHiddenTraceIds: (
    f: (curr: Set<string>) => Set<string>,
  ) => void;
  export let hidden: boolean;
  export let previewSize: number;
  export let previewStyle: "simplified" | "full";
  export let allIds: string[];
  export let updateMaxWidth: (width: number) => void;

  let myWidth: number;

  onMount(() => {
    updateMaxWidth(myWidth);
  });
</script>

<div
  class="trace-legend"
  style:opacity={hidden ? "0.5" : 1}
  use:observeClientSize={([w]) => (myWidth = w)}
  use:oneOrDoubleclick={{
    single: () => {
      updateHiddenTraceIds((curr) => {
        if (hidden) curr.delete(styledTrace.traceId);
        else curr.add(styledTrace.traceId);
        return curr;
      });
    },
    double: () =>
      updateHiddenTraceIds((curr) => {
        if (
          curr.size === 0 ||
          (curr.size === 1 && curr.has(styledTrace.traceId))
        ) {
          curr = new Set(allIds);
          curr.delete(styledTrace.traceId);
        } else curr.clear();
        return curr;
      }),
  }}
  role="presentation"
>
  <div class="trace-preview" class:simplified={previewStyle === "simplified"}>
    <TracePreview
      previewedTrace={styledTrace}
      previewHeight={previewSize}
      previewWidth={previewSize}
      simplified={previewStyle === "simplified"}
    />
  </div>
  {styledTrace.label ?? styledTrace.traceId}
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
