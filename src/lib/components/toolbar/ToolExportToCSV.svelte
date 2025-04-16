<script lang="ts">
  import { faFileCsv } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  /** Use <a> element to download as opposed to a stream. This approach is widely supported but may take up more time and or memory */
  export let useAnchorDownload = false;

  const { getTraceList, getTitle } =
    getContext(toolKey) ??
    yeet("Attempting to use a chart tool outside of a chart.");

  function exportCSV() {
    if (getTraceList === undefined) return;
    const fileName = `${getTitle?.() || "chartium"}.csv`;

    const supportsFileSystemAccess =
      window.isSecureContext &&
      "showSaveFilePicker" in window &&
      (() => {
        try {
          return window.self === window.top;
        } catch {
          return false; // Cross-origin ⇒ window.top throws
        }
      })();

    const method =
      useAnchorDownload || !supportsFileSystemAccess ? "anchor" : "fs-api";

    getTraceList().exportData().csv().download({ fileName, method });
  }
</script>

<ToolbarButton on:click={exportCSV} icon={faFileCsv} title="Export to CSV" />
