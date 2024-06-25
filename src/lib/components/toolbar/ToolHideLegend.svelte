<script lang="ts">
  import { getContext } from "svelte";
  import { faList } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";

  const toggleLegend = getContext(toolKey)?.toggleLegend;
</script>

<ToolbarButton title="Toggle legend" icon={faList} on:click={toggleLegend} />
