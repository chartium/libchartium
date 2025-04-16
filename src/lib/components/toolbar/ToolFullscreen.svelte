<script lang="ts">
  import { faExpand, faCompress } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  const { fullscreen$ } =
    getContext(toolKey) ??
    yeet("Attempting to use a chart tool outside of a chart.");
</script>

<ToolbarButton
  title={$fullscreen$ ? "Exit fullscreen" : "Enter fullscreen"}
  on:click={() => fullscreen$?.update((f) => !f)}
  icon={$fullscreen$ ? faCompress : faExpand}
/>
