<script lang="ts">
  import { faExpand } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";

  const Fa = Fa_1 as any as typeof Fa_2;
  const toggleFullscreen = getContext(toolKey)?.toggleFullscreen;
</script>

<ToolbarButton title="Toggle fullscreen" on:click={toggleFullscreen}>
  <Fa icon={faExpand} />
</ToolbarButton>
