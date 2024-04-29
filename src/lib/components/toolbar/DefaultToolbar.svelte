<script lang="ts">
  import ToolHideLegend from "./ToolHideLegend.svelte";
  import ToolExportToPNG from "./ToolExportToPNG.svelte";
  import ToolExportToCsv from "./ToolExportToCSV.svelte";
  import ToolFullscreen from "./ToolFullscreen.svelte";
</script>

<!-- <ToolbarButton title="Autoscale Y axis">
  <Fa icon={faUpDown} />
</ToolbarButton>
<ToolbarButton title="Change timezones">
  <Fa icon={faUserClock} />
</ToolbarButton> -->
<ToolExportToPNG />
<ToolExportToCsv />
<ToolFullscreen />
<ToolHideLegend />
