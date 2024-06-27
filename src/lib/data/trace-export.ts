import type { TraceList } from "../mod.js";
import { type ChartRange, type VariantHandle } from "../types.js";
import { toNumeric } from "../units/mod.js";
import { variantIds } from "./variant-ids.js";
import { PARAMS } from "./trace-list.js";
import type { Bundle } from "./bundle.js";
import { Queue } from "@typek/typek";

export type ExportRow = {
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

export function* exportTraceListData(
  traces: TraceList,
  { range }: TraceListExportOptions = {},
): IterableIterator<ExportRow> {
  range ??= traces.range;
  const linesPerBuffer = 1000;

  let unfinishedBundles = traces[PARAMS].bundles.slice();
  const buffers: Map<Bundle, Float64Array> = unfinishedBundles.reduce(
    (map, bundle) => {
      map.set(
        bundle,
        new Float64Array((bundle.traces.length + 1) * linesPerBuffer),
      );
      return map;
    },
    new Map(),
  );
  // fill up queues for all buffers
  const queues: Map<Bundle, Queue<ExportRow>> = new Map(
    unfinishedBundles.map((bundle) => [bundle, new Queue<ExportRow>()]),
  );
  const currentBufferLength: Map<Bundle, number> = new Map();
  const fillUpQueue = (bundle: Bundle, from: number) => {
    const buffer = buffers.get(bundle)!;
    const handles = bundle.traces;
    const length = bundle.boxed.export_to_buffer(buffer, handles, {
      from,
      to: toNumeric(range!.to, bundle.xDataUnit),
    });
    currentBufferLength.set(bundle, length);

    const queue = queues.get(bundle)!;
    let row: ExportRow = { x: buffer[0], y: {} };
    for (const [i, el] of buffer.entries()) {
      if (i >= length) break;

      const columnCount = handles.length + 1;
      const columnIndex = i % columnCount;
      const isFirstColumn = columnIndex === 0;
      const isLastColumn = columnIndex === columnCount - 1;

      if (isFirstColumn) row = { x: el, y: {} };
      else {
        row.y[
          variantIds.get(
            handles[(i % (handles.length + 1)) - 1] as VariantHandle,
          )!
        ] = el;
      }
      if (isLastColumn) queue.enqueue(row);
    }
  };

  unfinishedBundles.forEach((b) =>
    fillUpQueue(b, toNumeric(range!.from, b.xDataUnit)),
  );
  unfinishedBundles = unfinishedBundles.filter(
    (b) => queues.get(b)!.size !== 0,
  );

  const lastLines: Map<Bundle, ExportRow> = new Map(
    unfinishedBundles
      .map((b) => [b, queues.get(b)!.peek()] as const)
      .filter((_, q) => q !== undefined) as [Bundle, ExportRow][],
  );

  // TODO implement different interpolation strategies
  const getOrInterpolate = (x: number, bundle: Bundle, lastLine: ExportRow) => {
    const thisQueue = queues.get(bundle)!;
    const nextLine = thisQueue.peek()!;
    if (x === nextLine.x) return thisQueue.dequeue()!;
    const fraction = (x - lastLine.x) / (nextLine.x - lastLine.x);
    const toReturn: ExportRow = { x: x, y: {} };
    for (const id of Object.keys(lastLine)) {
      toReturn.y[id] =
        fraction * (nextLine.y[id] - lastLine.y[id]) + lastLine.y[id];
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
            .map((h) => h.x),
        ),
      ),
    )
      .flat()
      .toSorted((a, b) => a - b);
    if (xs[0] === lastX) {
      xs.shift();
      for (const q of queues.values()) if (q.peek()?.x === lastX) q.dequeue();
    }
    const rangeToInLatest = Math.max(
      ...unfinishedBundles.map((b) => toNumeric(range!.to, b.xDataUnit)),
    );
    if (xs[0] >= rangeToInLatest || xs.length === 0) break;
    for (const x of xs) {
      let row: ExportRow = { x: x, y: {} };
      for (const bundle of unfinishedBundles) {
        if (queues.get(bundle)!.peek() === undefined) {
          continue;
        }
        if (queues.get(bundle)!.peek()?.x === x)
          lastLines.set(bundle, queues.get(bundle)!.peek()!);

        row = {
          ...row,
          ...getOrInterpolate(x, bundle, lastLines.get(bundle)!),
        };
      }
      toWrite.push(row);
    }

    for (const line of toWrite) yield line;

    lastX = xs.at(-1)!;
    unfinishedBundles.forEach((b) => fillUpQueue(b, lastX));
    unfinishedBundles = unfinishedBundles.filter(
      (b) => queues.get(b)!.size !== 0,
    );
  }
}
