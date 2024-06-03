<script lang="ts">
  import { faExpand, faCompress } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";

  const fullscreen$ = getContext(toolKey)?.fullscreen$;
</script>

<ToolbarButton
  title={$fullscreen$ ? "Exit fullscreen" : "Enter fullscreen"}
  on:click={() => fullscreen$?.update((f) => !f)}
  icon={$fullscreen$ ? faCompress : faExpand}
/>
