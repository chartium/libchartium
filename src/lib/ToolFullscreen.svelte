<script lang="ts">
  import { faList, faExpand } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  import ToolbarButton from "./chart/Toolbar/ToolbarButton.svelte";
  const Fa = Fa_1 as any as typeof Fa_2;
</script>

<ToolbarButton title="Toggle fullscreen" on:click>
  <Fa icon={faExpand} />
</ToolbarButton>
