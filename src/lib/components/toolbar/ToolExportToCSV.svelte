<script lang="ts">
  import { faFileCsv } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import {
    downloadCSVSensibly,
    downloadCSVUnhingedly,
  } from "../../utils/downloaders.js";
  import { getContext } from "svelte";

  /** Use <a> element to download as opposed to a stream. This approach is widely supported but may take up more time and or memory */
  export let useAnchorDownload = false;

  const getTracelist = getContext(toolKey)?.getTracelist;
  const getTitle = getContext(toolKey)?.getTitle;

  function exportCSV() {
    if (getTracelist === undefined) return;
    const filename = `${getTitle?.() || "chartium"}.csv`;
    const supportsFileSystemAccess =
      "showSaveFilePicker" in window &&
      (() => {
        try {
          return window.self === window.top;
        } catch {
          return false;
        }
      })();

    if (supportsFileSystemAccess && !useAnchorDownload) {
      downloadCSVSensibly(getTracelist(), filename);
    } else {
      downloadCSVUnhingedly(getTracelist(), filename);
    }
  }
</script>

<ToolbarButton on:click={exportCSV} icon={faFileCsv} title="Export to CSV" />
