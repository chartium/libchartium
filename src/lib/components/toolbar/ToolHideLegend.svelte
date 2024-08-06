<script lang="ts">
  import { faList } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  const { toggleLegend } =
    getContext(toolKey) ??
    yeet("Attemting to use a chart tool outside of a chart.");
</script>

<ToolbarButton title="Toggle legend" icon={faList} on:click={toggleLegend} />
