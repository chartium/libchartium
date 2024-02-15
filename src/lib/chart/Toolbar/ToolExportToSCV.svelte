<script lang="ts">
  import { faFileCsv } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";
  import type { ExportHeader } from "../../types.js";
  const getTracelist = getContext(toolKey)?.getTracelist;
  function exportCSV() {
    if (getTracelist === undefined) return;
    const NO_DATA = "";

    const traceList = getTracelist();
    const ids = Array.from(traceList.traces());
    const header = `timestamp,${ids.join(",")}`;
    const transformer = (row: ExportHeader) =>
      `${row.x},${ids.map((id) => row[id] ?? NO_DATA).join(",")}\n`;

    const writer = {
      ready: Promise.resolve(undefined),
      write: (x: string) => {
        console.log(x);
        return Promise.resolve();
      },
    };

    writer.write(header);
    traceList.exportDdata(writer, transformer, traceList.range);
  }
</script>

<ToolbarButton on:click={exportCSV} icon={faFileCsv} title="Export to CSV" />
