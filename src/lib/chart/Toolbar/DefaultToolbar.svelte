<script lang="ts">
  import ToolbarButton from "./ToolbarButton.svelte";
  import { faUpDown, faUserClock } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  import ToolHideLegend from "./ToolHideLegend.svelte";
  import ToolExportToPNG from "./ToolExportToPNG.svelte";
  const Fa = Fa_1 as any as typeof Fa_2;
</script>

<ToolExportToPNG />
<ToolHideLegend />
<ToolbarButton title="Autoscale Y axis">
  <Fa icon={faUpDown} />
</ToolbarButton>
<ToolbarButton title="Change timezones">
  <Fa icon={faUserClock} />
</ToolbarButton>
