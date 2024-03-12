<script lang="ts">
  import { faFileCsv } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";
  import {
    downloadCSVSensibly,
    downloadCSVUnhingedly,
  } from "../../utils/downloaders.js";
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

    if (supportsFileSystemAccess) {
      downloadCSVSensibly(getTracelist(), filename);
    } else {
      downloadCSVUnhingedly(getTracelist(), filename);
    }
  }
</script>

<ToolbarButton on:click={exportCSV} icon={faFileCsv} title="Export to CSV" />
