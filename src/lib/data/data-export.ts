import type { StatsTable, TraceList } from "../mod.js";
import { type ChartRange } from "../types.js";
import { unitConversionFactor } from "../units/mod.js";
import { variantIds } from "./variant-ids.js";
import { PARAMS } from "./trace-list.js";
import { assertNever, enumerate, map, pipe, yeet } from "@typek/typek";
import { joinSeq } from "../utils/collection.js";
import { UnknownVariantHandleError } from "../errors.js";

export type TraceExportRow = {
  x: number;
  y: { [traceId: string]: number };
};

/**
 * Export data of all traces into a stream.
 * @param writer
 * @param transformer
 * @param range
 * @param interpolationStrategy How to interpolate missing ys
 */
export interface TraceListExportOptions {
  range?: ChartRange;
}

export class TraceListExport {
  constructor(
    public readonly traces: TraceList,
    private readonly options: TraceListExportOptions,
  ) {}

  [Symbol.iterator](): IterableIterator<TraceExportRow> {
    return this.rows();
  }

  *rows(this: TraceListExport): IterableIterator<TraceExportRow> {
    const { traces } = this;
    const range = this.options.range ?? traces.range;
    const bufferSize = 1000;
    const { bundles, handles } = traces[PARAMS];
    const handleSet = new Set(handles);
    const iterables = bundles.map((b) => b.rawData({ range, bufferSize }));

    yield* joinSeq({
      iterables,
      by: (point) => point[0],
      select: (pts) => Math.min(...pts),
      combine(x, currentDataPoints) {
        const y: Record<string, number> = Object.create(null);

        for (const [bundleIndex, bundle] of enumerate(bundles)) {
          const pointOpt = currentDataPoints[bundleIndex];
          const yConversionFactor = unitConversionFactor(
            bundle.yDataUnit,
            traces.yDataUnit,
          );

          // skip points that are missing for this x
          if (pointOpt.isNone) continue;
          const point = pointOpt.inner;

          for (const [yIndex, handle] of enumerate(bundle.traces)) {
            // skip Bundle traces that are excluded from the TraceList
            if (!handleSet.has(handle)) continue;

            const id =
              variantIds.get(handle) ?? yeet(UnknownVariantHandleError, handle);

            y[id] = yConversionFactor * point[yIndex + 1];
          }
        }

        return { x, y };
      },
    });
  }

  csv(
    this: TraceListExport,
    { valueOnMissingData }: { valueOnMissingData?: string } = {},
  ): ExportTextFile {
    valueOnMissingData ??= "";
    const self = this;

    return new ExportTextFile("export.csv", function* () {
      const ids = Array.from(self.traces.traces());
      yield `timestamp,${ids.join(",")}\n`;

      for (const { x, y } of self.rows()) {
        yield `${x},${ids.map((id) => y[id] ?? valueOnMissingData).join(",")}\n`;
      }
    });
  }
}

export class StatsTableExport {
  constructor(public readonly statsTable: StatsTable<any>) {}

  csv(
    this: StatsTableExport,
    {
      valueOnMissingData,
      orientation,
    }: {
      valueOnMissingData?: string;
      orientation?: "one-stat-per-row" | "one-variant-per-row";
    } = {},
  ): ExportTextFile {
    valueOnMissingData ??= "";
    orientation ??= "one-variant-per-row";
    const self = this;

    return new ExportTextFile("export.csv", function* () {
      const statTitles = pipe(
        self.statsTable.iterateStats(),
        (stats) =>
          map(stats, (s) =>
            "unit" in s ? `${s.statTitle} [${s.unit}]` : s.statTitle,
          ),
        Array.from<string>,
      );

      const variantTitles = pipe(
        self.statsTable.iterateVariants(),
        (variants) => map(variants, (v) => v.style.label ?? v.variantId),
        Array.from<string>,
      );

      if (orientation === "one-variant-per-row") {
        yield `variant,${statTitles.join(",")}`;
        for (const variant of self.statsTable.iterateVariants()) {
          yield `${variantTitles.shift()},${variant.stats.map((s) => s.value).join(",")}`;
        }
      } else {
        yield `stat,${variantTitles.join(",")}`;
        for (const stat of self.statsTable.iterateStats()) {
          yield `${statTitles.shift()},${stat.variants.map((v) => v.value).join(",")}`;
        }
      }
    });
  }
}

export interface ExportDownloadOptions {
  fileName?: string;
  method?: "anchor" | "fs-api";
}

export class ExportTextFile {
  constructor(
    public readonly defaultFileName: string,
    public readonly lines: () => IterableIterator<string>,
  ) {}

  [Symbol.iterator](): IterableIterator<string> {
    return this.lines();
  }

  async download(
    this: ExportTextFile,
    { fileName, method }: ExportDownloadOptions = {},
  ): Promise<void> {
    fileName ??= this.defaultFileName;
    method ??= "anchor";

    switch (method) {
      case "anchor":
        return downloadViaAnchor(this.lines(), fileName);
      case "fs-api":
        return downloadViaFileSystemApi(this.lines(), fileName);
      default:
        assertNever(method);
    }
  }
}

function downloadViaAnchor(lines: Iterable<string>, fileName: string): void {
  const blob = new Blob(Array.from(lines), { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadViaFileSystemApi(
  lines: Iterable<string>,
  fileName: string | undefined,
): Promise<void> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: fileName,
  });
  const writer = (await fileHandle.createWritable()).getWriter();

  for (const line of lines) {
    await writer.ready;
    await writer.write(line);
  }

  await writer.close();
}
