<script lang="ts">
  import { faList } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { getContext } from "svelte-typed-context";
  import { toolKey } from "./toolKey.js";
  const Fa = Fa_1 as any as typeof Fa_2;

  const toggleLegend = getContext(toolKey)?.toggleLegend;
</script>

<ToolbarButton title="Toggle legend" on:click={toggleLegend}>
  <Fa icon={faList} />
</ToolbarButton>
