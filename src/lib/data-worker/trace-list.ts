import {
  Quantity,
  type ChartValuePoint,
  type Range,
  type TraceHandle,
  type Unit,
  type ChartValue,
} from "../types.js";
import { lib } from "./wasm.js";
import {
  computeTraceColor,
  defaultStyle,
  resolveTraceInfo,
  type ResolvedTraceInfo,
  type TraceStyle,
  type TraceStylesheet,
  type TraceDataUnits,
  simplifyTraceInfo,
} from "./trace-styles.js";
import { yeet } from "yeet-ts";
import { UnknownTraceHandleError } from "../errors.js";
import { traceIds } from "./controller.js";
import {
  filter,
  flatMap,
  intersection,
  map,
  reduce,
  some,
  unique,
  zip,
} from "../utils/collection.js";
import { proxyMarker } from "comlink";
import type { Color } from "../utils/color.js";
import {
  qdnMax,
  qdnMin,
  toNumeric,
  toNumericRange,
  toQuantOrDay,
  toRange,
  unitEqual,
} from "../utils/quantityHelpers.js";
import {
  exportTraceListData,
  type TraceListExportOptions,
} from "./trace-export.js";
import type { NumericDateFormat } from "../index.js";

export const BUNDLES = Symbol("bundles");
export const HANDLES = Symbol("handles");
export const TRACE_INFO = Symbol("trace info");
export const LABELS = Symbol("labels");

export interface TraceInfo {
  id: string;
  label: string | undefined;

  width: number;
  color: Color;
  showPoints: boolean;

  xDataUnit: Unit | NumericDateFormat | undefined;
  yDataUnit: Unit | NumericDateFormat | undefined;
}

export interface QDTraceMetas {
  traceId: string;
  min: ChartValue;
  max: ChartValue;
  avg: ChartValue;
  avg_nz: ChartValue;
}

export class TraceList {
  [proxyMarker] = true;

  #traceHandles: TraceHandle[];
  #bundles: lib.BoxedBundle[];
  #statistics: QDTraceMetas[] | undefined;
  #labels: ReadonlyMap<string, string>;
  #traceInfo: ResolvedTraceInfo;
  #range: Range;

  #traceHandleSet_: Set<TraceHandle> | undefined;
  get #traceHandlesSet(): Set<TraceHandle> {
    if (!this.#traceHandleSet_)
      this.#traceHandleSet_ = new Set(this.#traceHandles);
    return this.#traceHandleSet_;
  }

  constructor(params: {
    handles: TraceHandle[];
    range: Range;
    bundles: lib.BoxedBundle[];
    labels: ReadonlyMap<string, string>;
    traceInfo: ResolvedTraceInfo | null;
  }) {
    this.#traceHandles = params.handles;
    this.#range = params.range;
    this.#bundles = params.bundles;
    this.#labels = params.labels;
    this.#traceInfo =
      params.traceInfo ?? resolveTraceInfo({}, [], params.handles, traceIds);
  }

  static empty() {
    return new TraceList({
      handles: [],
      range: { from: 0, to: 1 },
      bundles: [],
      traceInfo: [],
      labels: new Map(),
    });
  }

  /**
   * The x axis range this trace list is limited to.
   */
  get range(): Range {
    return { ...this.#range };
  }

  /**
   * The number of traces in this trace list.
   */
  get traceCount(): number {
    return this.#traceHandles.length;
  }

  /**
   * An iterable containing all the trace ids of this list.
   */
  *traces(): Iterable<string> {
    for (const handle of this.#traceHandles) {
      const id = traceIds.get(handle as TraceHandle);
      yield id ?? yeet(UnknownTraceHandleError, handle);
    }
  }

  /**
   * Returns basic information about the trace, like its style and units.
   */
  getTraceInfo(id: string): TraceInfo {
    const info: TraceStyle & TraceDataUnits =
      this.#traceInfo.find(([ids]) => ids.has(id))?.[1] ?? defaultStyle;

    return {
      id,
      ...info,
      xDataUnit: info.xDataUnit,
      yDataUnit: info.yDataUnit,
      color: computeTraceColor(id, info.color),
      label: this.#labels.get(id),
    };
  }

  get [BUNDLES]() {
    return this.#bundles;
  }
  get [HANDLES]() {
    return this.#traceHandles;
  }
  get [TRACE_INFO]() {
    return this.#traceInfo;
  }
  get [LABELS]() {
    return this.#labels;
  }

  /**
   * Returns units that traces of input bundle use
   */
  getBundleUnits(bundle: lib.BoxedBundle): {
    x: Unit | NumericDateFormat | undefined;
    y: Unit | NumericDateFormat | undefined;
  } {
    const firstTrace = bundle.traces()[0] as TraceHandle | undefined;
    if (!firstTrace) return { x: undefined, y: undefined };

    const traceId = traceIds.get(firstTrace)!;
    const { xDataUnit, yDataUnit } = this.getTraceInfo(traceId);
    return { x: xDataUnit, y: yDataUnit };
  }

  /**
   * Create a new trace list with the same traces and identical range, but modified styles.
   */
  withStyle(stylesheet: TraceStylesheet): TraceList {
    return new TraceList({
      handles: this.#traceHandles,
      range: this.#range,
      bundles: this.#bundles,
      labels: this.#labels,
      traceInfo: [
        ...resolveTraceInfo(
          stylesheet,
          this.#traceInfo,
          this.#traceHandles,
          traceIds,
        ),
      ],
    });
  }

  /**
   * Set the units of all data in this trace list. This function doesn't do
   * any unit conversions, nor does it modify the data – rather, it re-interprets
   * the stored data as if it always had these units.
   */
  withDataUnits(newUnits: {
    x?: Unit | NumericDateFormat;
    y?: Unit | NumericDateFormat;
  }) {
    const traceInfo: ResolvedTraceInfo = this.#traceInfo.map(([key, info]) => [
      key,
      {
        ...info,
        ...Object.fromEntries([
          ...("x" in newUnits ? [["xDataUnit", newUnits.x]] : []),
          ...("y" in newUnits ? [["yDataUnit", newUnits.y]] : []),
        ]),
      },
    ]);

    const { from, to } = this.#range;
    const oldUnits = this.getUnits()[0] ?? {};

    return new TraceList({
      handles: this.#traceHandles,
      range: {
        from: toQuantOrDay(toNumeric(from, oldUnits.x), newUnits.x),
        to: toQuantOrDay(toNumeric(to, oldUnits.x), newUnits.x),
      } as Range,
      bundles: this.#bundles,
      labels: this.#labels,
      traceInfo,
    });
  }

  /**
   * Create a new trace list with the same traces and styles, but limited to
   * the range provided. Traces and datapoints that are outside the range may
   * or may not be deleted – if you narrow down the range of a trace list and
   * than expand it again, don't expect you'll get back all the data.
   */
  withRange(range: Range): TraceList {
    const bundles: lib.BoxedBundle[] = [];
    for (const [units, traces] of this.getUnitsToTraceMap()) {
      const { from, to } = toNumericRange(range, units.x);
      const theseBundles = traces.#bundles;
      bundles.push(
        ...theseBundles.filter((bundle) => bundle.intersects(from, to)),
      );
    }

    const availableHandles = new Set(
      flatMap(bundles, (b) => b.traces() as Iterable<TraceHandle>),
    );
    const handles = this.#traceHandles.filter((t) => availableHandles.has(t));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      handles,
      range,
      bundles,
      labels: this.#labels,
      traceInfo: this.#traceInfo,
    });
  }

  /**
   * Creates a new trace list with the same range and styles, but excluding
   * traces with the provided ids.
   */
  withoutTraces(tracesToExclude: Iterable<string>) {
    const exclude = new Set(
      filter(
        map(tracesToExclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined,
      ),
    );

    const handles = this.#traceHandles.filter((h) => !exclude.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      handles,
      range: this.#range,
      bundles: this.#bundles,
      labels: this.#labels,
      traceInfo: this.#traceInfo.map((info) => {
        const firstID: string = info[0].values().next().value;
        const { xDataUnit, yDataUnit } = this.getTraceInfo(firstID);
        return [
          info[0],
          {
            ...info[1],
            xDataUnit,
            yDataUnit,
          },
        ];
      }), // handles.map((h) => this.getTraceInfo(traceIds.get(h)!)),
    });
  }

  /**
   * Creates a new trace list with the same range and styles that
   * only contains traces with the provided ids.
   */
  withTraces(tracesToInclude: Iterable<string>) {
    const include = new Set(
      filter(
        map(tracesToInclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined,
      ),
    );

    const handles = this.#traceHandles.filter((h) => include.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      handles,
      range: this.#range,
      bundles: this.#bundles,
      labels: this.#labels,
      traceInfo: this.#traceInfo,
    });
  }

  /**
   * Set trace labels by id
   */
  withLabels(newLabels: Iterable<[string, string | undefined]>) {
    const labels = new Map([
      ...this.#labels,
      ...filter(newLabels, (kv): kv is [string, string] => kv[1] !== undefined),
    ]);

    return new TraceList({
      handles: this.#traceHandles,
      range: this.#range,
      bundles: this.#bundles,
      labels: labels,
      traceInfo: this.#traceInfo,
    });
  }

  /** Returns new tracelist where every trace has at least one datapoint over threshold */
  withOverThreshold(threshold: Quantity | number): TraceList {
    const badHandles: TraceHandle[] = this.#bundles.flatMap((bundle) => {
      const ptrs = bundle.traces();
      const thresholdInBundleUnits = toNumeric(
        threshold,
        this.getBundleUnits(bundle).y,
      );
      const range = bundle.range();
      const { from, to } =
        range.type === "Bounded" ? range.value : { from: 0, to: 1 };
      const filter = bundle.are_traces_over_threshold(
        ptrs,
        from,
        to,
        thresholdInBundleUnits,
      );
      return bundle
        .get_multiple_traces_metas(
          ptrs.filter((_, i) => !filter[i]),
          from,
          to,
        )
        .map((meta) => meta.handle);
    });

    const ids = badHandles.map((handle) => traceIds.get(handle)!);

    return this.withoutTraces(ids as string[]);
  }

  /**
   * Creates a new trace list by concatenating the provided trace lists together.
   * The resulting range will be a bounding interval of all the individual lists'
   * ranges. Each trace's style will be preserved – if a trace is present in multiple
   * lists, style of its first occurrence will be preserved.
   */
  static union(...lists: TraceList[]): TraceList {
    const bundles = Array.from(unique(flatMap(lists, (l) => l[BUNDLES])));
    const handles = Array.from(unique(flatMap(lists, (l) => l[HANDLES])));
    if (handles.length === 0) return TraceList.empty();

    const from = reduce(
      map(
        filter(bundles, (b) => b.range().type === "Bounded"),
        (b) => b.range().value.from,
      ),
      Math.min,
    );
    const to = reduce(
      map(
        filter(bundles, (b) => b.range().type === "Bounded"),
        (b) => b.range().value.to,
      ),
      Math.max,
    );
    const labels = new Map(flatMap(lists, (l) => l[LABELS].entries()));
    const traceInfo = simplifyTraceInfo(
      lists.flatMap((l) => l.#traceInfo),
      handles,
      traceIds,
    );

    return new TraceList({
      handles,
      range: toRange({ from, to }, traceInfo[0]?.[1]?.xDataUnit),
      bundles,
      labels,
      traceInfo,
    });
  }

  /**
   * Calculate the statistics (like the maximum, minimum and average value)
   * for the provided traces on the provided range. If parameters are omitted,
   * it will use all traces and the entire range of this trace list.
   */
  calculateStatistics({
    traces,
    from,
    to,
  }: Partial<{
    traces: string[];
    from: ChartValue;
    to: ChartValue;
  }> = {}) {
    const unfiltered =
      from === undefined && to === undefined && traces === undefined;

    if (unfiltered && this.#statistics) return this.#statistics;

    const handles = traces
      ? Uint32Array.from(traces.map((id) => traceIds.getKey(id)!))
      : Uint32Array.from(this.#traceHandles);

    const counter = new lib.MetaCounter(handles.length);

    for (const bundle of this.#bundles) {
      const bundleRange = bundle.range();
      if (bundleRange.type === "Everywhere")
        counter.add_bundle(bundle, handles, bundleRange);
      else {
        const xUnit = this.getBundleUnits(bundle).x;
        const a = Math.max(
          from ? toNumeric(from, xUnit) : bundleRange.value.from,
          bundleRange.value.from,
        );
        const b = Math.min(
          to ? toNumeric(to, xUnit) : bundleRange.value.to,
          bundleRange.value.to,
        );
        if (a >= b) continue;
        counter.add_bundle(bundle, handles, {
          type: "Bounded",
          value: { from: a, to: b },
        });
      }
    }

    const metas: lib.TraceMetas[] = counter.to_array();

    const convertedMetas: QDTraceMetas[] = [];

    for (const [meta, traceHandle] of zip(metas, handles)) {
      const id = traceIds.get(traceHandle as TraceHandle)!;
      const { yDataUnit } = this.getTraceInfo(id);

      convertedMetas.push({
        traceId: id,
        min: toQuantOrDay(meta.min, yDataUnit),
        max: toQuantOrDay(meta.max, yDataUnit),
        avg: toQuantOrDay(meta.avg, yDataUnit),
        avg_nz: toQuantOrDay(meta.avg_nz, yDataUnit),
      });
    }
    if (unfiltered) this.#statistics = convertedMetas;
    return convertedMetas;
  }

  #yRange: Range | undefined;
  /**
   * Calculate the y axis range of this trace list.
   */
  getYRange(): Range {
    if (this.#yRange) return this.#yRange;
    const metas = this.calculateStatistics();
    if (metas.length === 0) return { from: 0, to: 1 };

    return {
      from: metas.reduce(
        (prev, { min: curr }) => qdnMin(prev as any, curr as any),
        metas[0].min,
      ),
      to: metas.reduce(
        (prev, { max: curr }) => qdnMax(prev as any, curr as any),
        metas[0].max,
      ),
    } as Range;
  }

  #units: ReturnType<typeof this.getUnits> | undefined;
  /**
   * List all the data unit pairs present in this trace list.
   *
   * By default, uploaded data have no units (`undefined`), however you can
   * set them using the `withDataUnits` method. If you make a union of
   * trace lists with different units, you will get a mixed units list.
   *
   * Take care when rendering a trace list with mixed units – if you
   * aren't intentional with it, you may get unexpected results.
   */
  getUnits(): {
    x: Unit | NumericDateFormat | undefined;
    y: Unit | NumericDateFormat | undefined;
  }[] {
    // FIXME this actually doesn't yet know how to spot date so it won't return it
    if (this.#units) return this.#units;
    const units = new Set<{ x: Unit | undefined; y: Unit | undefined }>();

    const addUnique = (
      set: Set<{
        x: Unit | NumericDateFormat | undefined;
        y: Unit | NumericDateFormat | undefined;
      }>,
      value: {
        x: Unit | NumericDateFormat | undefined;
        y: Unit | NumericDateFormat | undefined;
      },
    ): void => {
      const alreadyRecorded = some(set, (u) => {
        return unitEqual(u.x, value.x) && unitEqual(u.y, value.y);
      });
      if (alreadyRecorded) return;
      set.add(value);
    };

    for (const bundle of this.#bundles) {
      const { x, y } = this.getBundleUnits(bundle);
      addUnique(units, { x, y });
    }

    this.#units = Array.from(units);
    return this.#units;
  }

  #unitsToTraceMap: ReturnType<typeof this.getUnitsToTraceMap> | undefined;

  /**
   * @returns Returns a map of all the units present in this trace list to
   * the traces that use them.
   */
  getUnitsToTraceMap(): Map<
    {
      x: Unit | NumericDateFormat | undefined;
      y: Unit | NumericDateFormat | undefined;
    },
    TraceList // FIXME do we want tracelist here or ids?
  > {
    if (this.#unitsToTraceMap) return this.#unitsToTraceMap;

    const toReturn = new Map<
      {
        x: Unit | NumericDateFormat | undefined;
        y: Unit | NumericDateFormat | undefined;
      },
      TraceList
    >();
    for (const bundle of this.#bundles) {
      const { x, y } = this.getBundleUnits(bundle);
      const newTraceList = new TraceList({
        handles: Array.from(
          intersection(bundle.traces(), this.#traceHandlesSet),
        ) as TraceHandle[],
        range: this.#range,
        bundles: [bundle],
        labels: this.#labels,
        traceInfo: this.#traceInfo,
      });
      if (toReturn.has({ x, y })) {
        toReturn.set(
          { x, y },
          TraceList.union(toReturn.get({ x, y })!, newTraceList),
        );
      } else {
        toReturn.set({ x, y }, newTraceList);
      }
    }

    this.#unitsToTraceMap = toReturn;
    if (!this.#units) this.#units = Array.from(toReturn.keys());
    return toReturn;
  }

  /**
   * Finds the specified number of traces that are the closest to input point.
   * The point has to be im data's natural units
   * By default, the distance is measured only in the vertical direction (ie. you'll
   * only get trace points which are exactly below or above the reference point).
   *
   * TODO add a more precise euclidean distance mode
   */
  findClosestTracesToPoint(
    point: ChartValuePoint,
    howMany: number,
  ): {
    traceInfo: TraceInfo;
    closestPoint: ChartValuePoint;
  }[] {
    // FIXME make TraceList auto update its ranges based on ranges of bundles

    interface FoundPoint {
      handle: TraceHandle;
      point: ChartValuePoint;
      distance: number;
    }

    let closestPoints: FoundPoint[] = [];

    for (const bundle of this.#bundles) {
      const bundleTraces = new Uint32Array(
        intersection(bundle.traces(), this.#traceHandlesSet),
      );
      const bundleUnits = this.getBundleUnits(bundle);
      const x = toNumeric(point.x, bundleUnits.x);
      const y = toNumeric(point.y, bundleUnits.y);
      const foundPoints = bundle.find_n_closest_points(
        bundleTraces,
        x,
        y,
        howMany,
      );

      for (const foundPoint of foundPoints) {
        const distance = Math.sqrt(
          (foundPoint.x - x) ** 2 + (foundPoint.y - y) ** 2,
        );
        closestPoints.push({
          handle: foundPoint.handle as TraceHandle,
          point: {
            x: toQuantOrDay(foundPoint.x, bundleUnits.x),
            y: toQuantOrDay(foundPoint.y, bundleUnits.y),
          } as ChartValuePoint,
          distance,
        });
      }

      closestPoints.sort((a, b) => a.distance - b.distance);
      closestPoints = closestPoints.slice(0, howMany);
    }

    if (closestPoints.length === 0) return [];

    const results: {
      traceInfo: TraceInfo;
      closestPoint: ChartValuePoint;
    }[] = [];

    for (const { point, handle } of closestPoints) {
      const id = traceIds.get(handle as TraceHandle);
      if (id === undefined) {
        yeet(UnknownTraceHandleError, handle);
      }
      const traceInfo = this.getTraceInfo(id);
      results.push({
        traceInfo,
        closestPoint: point,
      });
    }

    return results;
  }

  /**
   * Export data of all traces into a stream.
   * @param writer A writer that writes the output of transformer into whatever you want
   * @param transformer Function that turns one "line" of data into whatever format the writer will write
   * @param range From what range to export
   * @param interpolationStrategy How to interpolate missing ys
   */
  async exportData(opts: TraceListExportOptions) {
    return exportTraceListData(this, opts);
  }
}
