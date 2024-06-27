import { concat, map, pipe } from "@typek/typek";
import type { TraceList } from "../mod.js";

/** Copies the tracelist data and makes an anchor element to download it and clicks it */
export async function downloadCSVUnhingedly(
  tracelist: TraceList,
  filename: string,
) {
  const NO_DATA = "";

  const ids = Array.from(tracelist.traces());

  const rows = pipe(
    tracelist.exportData(),

    // format rows
    (x) =>
      map(
        x,
        ({ x, y }) => `${x},${ids.map((id) => y[id] ?? NO_DATA).join(",")}\n`,
      ),

    // prepend header
    (x) => concat([`timestamp,${ids.join(",")}\n`], x),

    // collect
    Array.from<string>,
  );

  const blob = new Blob(rows, { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Streams tracelist data into a csv file */
export async function downloadCSVSensibly(
  tracelist: TraceList,
  filename: string,
) {
  const NO_DATA = "";

  const fileHandle = await window.showSaveFilePicker({
    suggestedName: filename,
  });
  const writer = (await fileHandle.createWritable()).getWriter();

  const ids = Array.from(tracelist.traces());

  await writer.ready;
  await writer.write(`timestamp,${ids.join(",")}\n`);

  for (const row of tracelist.exportData()) {
    await writer.ready;
    await writer.write(
      `${row.x},${ids.map((id) => row.y[id] ?? NO_DATA).join(",")}\n`,
    );
  }

  await writer.close();
}
