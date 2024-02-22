import type { TraceList } from "../index.js";
import { X, type ExportRow } from "../types.js";

/** Copies the tracelist data and makes an anchor element to download it and clicks it */
export async function downloadCSVUnhingedly(
  tracelist: TraceList,
  filename: string,
) {
  const NO_DATA = "";

  const ids = Array.from(tracelist.traces());
  const header = `timestamp,${ids.join(",")}\n`;
  const transformer = (row: ExportRow) =>
    `${row[X]},${ids.map((id) => row[id] ?? NO_DATA).join(",")}\n`;

  const rows: string[] = [];
  const writer: Pick<WritableStreamDefaultWriter, "ready" | "write"> = {
    ready: Promise.resolve(undefined),
    write: (data: string) => {
      rows.push(data);
      return Promise.resolve();
    },
  };
  await tracelist.exportData({ writer, transformer });

  const blob = new Blob([header, ...rows], { type: "text/csv" });
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
  const fileHandle: FileSystemFileHandle = await (
    window as any
  ).showSaveFilePicker({
    suggestedName: filename,
  });
  const writer = (await fileHandle.createWritable()).getWriter();

  const NO_DATA = "";

  const ids = Array.from(tracelist.traces());
  const header = `timestamp,${ids.join(",")}\n`;
  const transformer = (row: ExportRow) =>
    `${row[X]},${ids.map((id) => row[id] ?? NO_DATA).join(",")}\n`;

  writer.ready.then(() => writer.write(header));

  return tracelist.exportData({ writer, transformer });
}
