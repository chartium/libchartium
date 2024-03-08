import type { BoxedBundle } from "../../../dist/wasm/libchartium.js";
import type { TraceList } from "../index.js";
import {
  X,
  type ExportRow,
  type Range,
  type TypedArray,
  type TraceHandle,
} from "../types.js";
import { toNumeric } from "../utils/quantityHelpers.js";
import { Queue } from "../utils/queue.js";
import { traceIds } from "./controller.js";
import { BUNDLES } from "./trace-list.js";
import type { lib } from "./wasm.js";

/**
 * Export data of all traces into a stream.
 * @param writer
 * @param transformer
 * @param range
 * @param interpolationStrategy How to interpolate missing ys
 */
export interface TraceListExportOptions {
  /** A writer that writes the output of transformer into whatever you want */
  writer: Pick<WritableStreamDefaultWriter, "ready" | "write">;
  /** Function that turns one row of data into whatever format the writer will write */
  transformer: (
    data: ExportRow,
  ) => ArrayBuffer | TypedArray | DataView | Blob | string;

  /** From what range to export. Defaults to `traceList.range` */
  range?: Range;
}

export async function exportTraceListData(
  traces: TraceList,
  { writer, transformer, range }: TraceListExportOptions,
) {
  range ??= traces.range;

  const linesPerBuffer = 1000;
  const writeLine = async (data: ExportRow) => {
    writer.ready.then(() => {
      writer.write(transformer(data));
    });
  };

  let unfinishedBundles = traces[BUNDLES].slice();
  const buffers: Map<BoxedBundle, Float64Array> = unfinishedBundles.reduce(
    (map, bundle) => {
      map.set(
        bundle,
        new Float64Array((bundle.traces().length + 1) * linesPerBuffer),
      );
      return map;
    },
    new Map(),
  );
  // fill up queues for all buffrs
  const queues: Map<BoxedBundle, Queue<ExportRow>> = new Map(
    unfinishedBundles.map((bundle) => [bundle, new Queue<ExportRow>()]),
  );
  const currentBufferLength: Map<BoxedBundle, number> = new Map();
  const fillUpQueue = (bundle: lib.BoxedBundle, from: number) => {
    const buffer = buffers.get(bundle)!;
    const handles = bundle.traces();
    const length = bundle.export_to_buffer(
      buffer,
      handles,
      from,
      toNumeric(range!.to, traces.getBundleUnits(bundle).x),
    );
    currentBufferLength.set(bundle, length);

    const queue = queues.get(bundle)!;
    let row: ExportRow = { [X]: buffer[0] };
    for (const [i, el] of buffer.entries()) {
      if (i >= length) break;

      const columnCount = handles.length + 1;
      const columnIndex = i % columnCount;
      const isFirstColumn = columnIndex === 0;
      const isLastColumn = columnIndex === columnCount - 1;

      if (isFirstColumn) row = { [X]: el };
      else {
        row[
          traceIds.get(handles[(i % (handles.length + 1)) - 1] as TraceHandle)!
        ] = el;
      }
      if (isLastColumn) queue.enqueue(row);
    }
  };

  unfinishedBundles.forEach((b) =>
    fillUpQueue(b, toNumeric(range!.from, traces.getBundleUnits(b).x)),
  );
  unfinishedBundles = unfinishedBundles.filter(
    (b) => queues.get(b)!.length !== 0,
  );

  const lastLines: Map<BoxedBundle, ExportRow> = new Map(
    unfinishedBundles
      .map((b) => [b, queues.get(b)!.peek()] as const)
      .filter((_, q) => q !== undefined) as [BoxedBundle, ExportRow][],
  );

  const getOrInterpolate = (
    x: number,
    bundle: BoxedBundle,
    lastLine: ExportRow,
  ) => {
    const thisQueue = queues.get(bundle)!;
    const nextLine = thisQueue.peek()!;
    if (x === nextLine[X]) return thisQueue.dequeue()!;
    // FIXME match the strategy
    const fraction = (x - lastLine[X]) / (nextLine[X] - lastLine[X]);
    const toReturn: ExportRow = { [X]: x };
    for (const id of Object.keys(lastLine)) {
      toReturn[id] = fraction * (nextLine[id] - lastLine[id]) + lastLine[id];
    }
    return toReturn;
  };
  let lastX = Number.NEGATIVE_INFINITY;
  while (unfinishedBundles.length > 0) {
    const toWrite: ExportRow[] = [];
    const xs = Array.from(
      new Set(
        unfinishedBundles.map((b) =>
          queues
            .get(b)!
            .peekAll()
            .map((h) => h[X]),
        ),
      ),
    )
      .flat()
      .toSorted((a, b) => a - b);
    if (xs[0] === lastX) {
      xs.shift();
      for (const q of queues.values()) if (q.peek()?.[X] === lastX) q.dequeue();
    }
    const rangeToInLatest = Math.max(
      ...unfinishedBundles.map((b) =>
        toNumeric(range!.to, traces.getBundleUnits(b).x),
      ),
    );
    if (xs[0] >= rangeToInLatest || xs.length === 0) break;
    for (const x of xs) {
      let row: ExportRow = { [X]: x };
      for (const bundle of unfinishedBundles) {
        if (queues.get(bundle)!.peek() === undefined) {
          continue;
        }
        if (queues.get(bundle)!.peek()?.[X] === x)
          lastLines.set(bundle, queues.get(bundle)!.peek()!);

        row = {
          ...row,
          ...getOrInterpolate(x, bundle, lastLines.get(bundle)!),
        };
      }
      toWrite.push(row);
    }

    for (const line of toWrite) {
      await writeLine(line);
    }
    lastX = xs.at(-1)!;
    unfinishedBundles.forEach((b) => fillUpQueue(b, lastX));
    unfinishedBundles = unfinishedBundles.filter(
      (b) => queues.get(b)!.length !== 0,
    );
  }
}
