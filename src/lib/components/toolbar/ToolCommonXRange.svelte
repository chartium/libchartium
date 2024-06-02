<script lang="ts">
  import ToolbarButton from "./ToolbarButton.svelte";
  import {
    faLeftRight,
    faArrowsLeftRightToLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { getContext } from "svelte-typed-context";
  import { toolKey } from "./toolKey.js";
  import { cons, derived } from "@mod.js/signals";

  const doUseCommonXRange$ = getContext(toolKey)?.doUseCommonXRange$;
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
