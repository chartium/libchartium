<script lang="ts">
  import ToolHideLegend from "./ToolHideLegend.svelte";
  import ToolExportToPNG from "./ToolExportToPNG.svelte";
  import ToolExportToCsv from "./ToolExportToCSV.svelte";
  import ToolFullscreen from "./ToolFullscreen.svelte";
  import ToolAutoscaleY from "./ToolAutoscaleY.svelte";
</script>

<ToolAutoscaleY />
<!--
<ToolbarButton title="Change timezones">
  <Fa icon={faUserClock} />
</ToolbarButton> -->
<ToolExportToPNG />
<ToolExportToCsv />
<ToolFullscreen />
<ToolHideLegend />
