<script lang="ts">
  import ToolbarButton from "./ToolbarButton.svelte";
  import {
    faLeftRight,
    faArrowsLeftRightToLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { toolKey } from "./toolKey.js";
  import { cons, derived } from "@typek/signalhead";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  const { doUseCommonXRange$ } =
    getContext(toolKey) ??
    yeet("Attemting to use a chart tool outside of a chart.");

  const icon$ = derived(($) =>
    $(doUseCommonXRange$ ?? cons(false))
      ? faArrowsLeftRightToLine
      : faLeftRight,
  );
  const onClick = () => {
    doUseCommonXRange$?.update((v) => !v);
  };
</script>

<ToolbarButton on:click={onClick} title="Sync X range" icon={$icon$} />
