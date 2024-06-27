<script lang="ts">
  import { faList } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "../../utils/svelte-context.js";

  const toggleLegend = getContext(toolKey)?.toggleLegend;
</script>

<ToolbarButton title="Toggle legend" icon={faList} on:click={toggleLegend} />
