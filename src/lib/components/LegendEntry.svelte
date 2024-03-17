<script lang="ts">
  import { onMount } from "svelte";
  import type { TraceInfo } from "../data-worker/trace-list.js";
  import TracePreview from "./TracePreview.svelte";
  import { oneOrDoubleclick } from "../utils/mouseActions.js";

  export let styledTrace: TraceInfo;
  export let updateHiddenTraceIds: (
    f: (curr: Set<string>) => Set<string>,
  ) => void;
  export let hidden: boolean;
  export let previewSize: number;
  export let previewStyle: "simplified" | "full";
  export let allIDs: string[];
  export let updateMaxWidth: (width: number) => void;

  let myWidth: number;

  onMount(() => {
    updateMaxWidth(myWidth);
  });
</script>

<div
  class="trace-legend"
  style:opacity={hidden ? "0.5" : 1}
  bind:clientWidth={myWidth}
  use:oneOrDoubleclick={{
    single: () => {
      updateHiddenTraceIds((curr) => {
        if (hidden) curr.delete(styledTrace.id);
        else curr.add(styledTrace.id);
        return curr;
      });
    },
    double: () =>
      updateHiddenTraceIds((curr) => {
        if (curr.size === 0 || (curr.size === 1 && curr.has(styledTrace.id))) {
          curr = new Set(allIDs);
          curr.delete(styledTrace.id);
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
  {styledTrace.label ?? styledTrace.id}
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
