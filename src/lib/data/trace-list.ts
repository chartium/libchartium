import {
  type ChartRange,
  type VariantHandle,
  type ChartValue,
  type DataUnit,
  type VariantHandleArray,
  Unit,
  type TypedArray,
  type TypeOfData,
} from "../types.js";
import { lib } from "../wasm.js";
import {
  oxidizeStyleSheet,
  oxidizeStyleSheetPatch,
  type TraceStyleSheet,
} from "./trace-styles.js";
import { UnknownVariantHandleError, UnknownVariantIdError } from "../errors.js";
import { registerNewVariantHandle, variantIds } from "./variant-ids.js";
import { intersection } from "../utils/collection.js";
import {
  maxValue,
  minValue,
  toNumeric,
  toNumericRange,
  toChartValue,
  toChartRange,
  assertAllUnitsCompatible,
  unitConversionFactor,
} from "../units/mod.js";
import {
  exportTraceListData,
  type ExportRow,
  type TraceListExportOptions,
} from "./trace-export.js";
import { Bundle } from "./bundle.js";
import { resolvedColorToHex } from "../utils/color.js";
import { hashAny } from "../utils/hash.js";
import type { InterpolationStrategy } from "../../../dist/wasm/libchartium.js";
import { isUnit } from "unitlib";
import {
  enumerate,
  filter,
  flatMap,
  fold,
  map,
  pipe,
  unique,
  yeet,
  zip,
} from "@typek/typek";

export const PARAMS = Symbol("trace-list-params");
export const CONSTRUCTOR = Symbol("trace-list-constructor");
export const LAZY = Symbol("trace-list-lazy");

export interface TraceStatistics {
  traceId: string;
  min: ChartValue;
  max: ChartValue;
  average: ChartValue;
  averageNonzero: ChartValue;
}

export interface ComputedTraceStyle {
  label: string | undefined;
  color: `#${string}`;
  points: lib.TracePointsStyle;
  line: lib.TraceLineStyle;
  "line-width": number;
  "palette-index": number;
  "z-index": number;
  "legend-priority": number;
}

export interface FromRowBufferParams {
  ids: string[];
  data: ArrayBuffer | TypedArray;
  xType: TypeOfData;
  yType: TypeOfData;
  xDataUnit?: DataUnit;
  yDataUnit?: DataUnit;
  style?: TraceStyleSheet;
  labels?: Iterable<[string, string | undefined]>;
}

export interface FromColumnsParams {
  x: {
    type: TypeOfData;
    unit?: DataUnit;
    data: ArrayBuffer | TypedArray;
  };
  y: {
    type: TypeOfData;
    unit?: DataUnit;
    columns: {
      id: string;
      data: ArrayBuffer | TypedArray;
    }[];
  };
  style?: TraceStyleSheet;
  labels?: Iterable<[string, string | undefined]>;
}

export interface FromThresholdsParams {
  ids: string[];
  ys: Float64Array;
  xDataUnit?: DataUnit;
  yDataUnit?: DataUnit;
  style?: TraceStyleSheet;
  labels?: Iterable<[string, string | undefined]>;
  tracelistsRange: ChartRange;
}

export interface TraceListParams {
  handles: VariantHandleArray;
  bundles: Bundle[];
  range: ChartRange;
  rangeArbitrary: boolean;

  labels: ReadonlyMap<string, string>;
  styles: lib.TraceStyleSheet;
  precomputedColorIndices: lib.ResolvedColorIndices | undefined;

  xDataUnit: DataUnit;
  yDataUnit: DataUnit;

  randomSeed: number;
}

export function randomUint() {
  return (Math.random() * 2 ** 32) >>> 0;
}

export class TraceList {
  #params: Readonly<TraceListParams>;
  private constructor(params: TraceListParams) {
    this.#params = params;
  }
  get [PARAMS]() {
    return this.#params;
  }
  static [CONSTRUCTOR](params: TraceListParams) {
    return new TraceList(params);
  }

  static empty() {
    return new TraceList({
      handles: new Uint32Array(),
      range: { from: 0, to: 1 },
      rangeArbitrary: true,
      bundles: [],

      labels: new Map(),
      styles: lib.TraceStyleSheet.unset(),
      precomputedColorIndices: undefined,

      xDataUnit: undefined,
      yDataUnit: undefined,

      randomSeed: randomUint(),
    });
  }

  /**
   * Create a trace list from a single two-dimensional
   * array buffer with row-oriented data, ie.
   * `[ x[0], y1[0], y2[0], ... x[1], y1[1], y2[1], ...]`.
   */
  static async fromRowBuffer({
    ids,
    data,
    xType,
    yType,
    xDataUnit,
    yDataUnit,
    style,
    labels,
  }: FromRowBufferParams): Promise<TraceList> {
    if (ids.length === 0) return TraceList.empty();

    const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer;

    const handles: VariantHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      handles[i] = variantIds.getKey(id) ?? registerNewVariantHandle(id);
    }

    const bulkload = await lib.Bulkloader.from_array(
      handles,
      xType,
      yType,
      new Uint8Array(dataBuffer),
    );

    const bundle = bulkload.apply();
    const range = bundle.range();
    if (range.type === "Everywhere") {
      throw Error("Unexpected error while parsing the trace list's range.");
    }

    let tl = new TraceList({
      handles,
      range: toChartRange(range.value, xDataUnit),
      rangeArbitrary: false,
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);
    return tl;
  }

  /**
   * Create a trace list from a common x-data buffer and
   * several y-data buffers, one per trace.
   */
  static fromColumns({ x, y, style, labels }: FromColumnsParams): TraceList {
    if (y.columns.length === 0) return TraceList.empty();

    const xBuffer = new Uint8Array(
      x.data instanceof ArrayBuffer ? x.data : x.data.buffer,
    );
    const yBuffers = y.columns.map(
      ({ data }) =>
        new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer),
    );

    const handles: VariantHandleArray = new Uint32Array(y.columns.length);

    for (const [i, { id }] of enumerate(y.columns)) {
      handles[i] = variantIds.getKey(id) ?? registerNewVariantHandle(id);
    }

    const bundle = lib.Bulkloader.from_columnar(
      handles,
      x.type,
      y.type,
      xBuffer,
      yBuffers,
    );

    const range = bundle.range();
    if (range.type === "Everywhere") {
      throw Error("Unexpected error while parsing the trace list's range.");
    }

    let tl = new TraceList({
      handles,
      range: toChartRange(range.value, x.unit),
      rangeArbitrary: false,
      bundles: [new Bundle(bundle, x.unit, y.unit)],
      labels: new Map(),
      styles: oxidizeStyleSheet(style),
      precomputedColorIndices: undefined,
      xDataUnit: x.unit,
      yDataUnit: y.unit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);

    return tl;
  }

  static fromThresholds({
    ids,
    ys,
    xDataUnit,
    yDataUnit,
    style,
    labels,
    tracelistsRange,
  }: FromThresholdsParams) {
    if (ids.length === 0) return TraceList.empty();

    const handles: VariantHandleArray = new Uint32Array(ids.length);

    for (const [i, id] of enumerate(ids)) {
      handles[i] = variantIds.getKey(id) ?? registerNewVariantHandle(id);
    }

    const bundle = lib.Bulkloader.threshold_from_array(handles, ys);

    // assert range's units are compatible with xDataUnit
    toNumericRange(tracelistsRange, xDataUnit);

    let tl = TraceList[CONSTRUCTOR]({
      handles,
      range: tracelistsRange,
      rangeArbitrary: true,
      bundles: [new Bundle(bundle, xDataUnit, yDataUnit)],
      styles: oxidizeStyleSheet(style),
      labels: new Map(),
      precomputedColorIndices: undefined,
      xDataUnit,
      yDataUnit,
      randomSeed: randomUint(),
    });

    if (labels) tl = tl.withLabels(labels);

    return tl;
  }

  /**
   * The x axis range this trace list is limited to.
   */
  get range(): ChartRange {
    return { ...this.#params.range };
  }

  /**
   * The number of traces in this trace list.
   */
  get traceCount(): number {
    return this.#params.handles.length;
  }

  get xDataUnit(): DataUnit {
    return this.#params.xDataUnit;
  }
  get yDataUnit(): DataUnit {
    return this.#params.yDataUnit;
  }

  get randomSeed(): number {
    return this.#params.randomSeed;
  }

  /**
   * An iterable containing all the trace ids of this list.
   */
  *traces(): Iterable<string> {
    for (const handle of this.#params.handles) {
      const id = variantIds.get(handle as VariantHandle);
      yield id ?? yeet(UnknownVariantHandleError, handle);
    }
  }

  #traceHandleSet_: Set<VariantHandle> | undefined;
  get #traceHandlesSet(): Set<VariantHandle> {
    if (!this.#traceHandleSet_)
      this.#traceHandleSet_ = new Set(this.#params.handles);
    return this.#traceHandleSet_;
  }

  #traceHandleStacks_: [null | number, Uint32Array][] | undefined;
  get #traceHandleStacks(): [null | number, Uint32Array][] {
    if (!this.#traceHandleStacks_) {
      const groupMap = new Map<null | number, [VariantHandle, number][]>();
      const getStack = (v: lib.TraceStyle["stack-group"]) => {
        if (v === "unset") return null;

        return v;
      };

      for (const handle of this.#params.handles) {
        const style = this.#params.styles.get_cloned(handle);
        const stack = getStack(style["stack-group"]);
        const zIndex = style["z-index"] === "unset" ? 0 : style["z-index"];

        if (groupMap.has(stack)) {
          groupMap.get(stack)!.push([handle, zIndex]);
        } else {
          groupMap.set(stack, [[handle, zIndex]]);
        }
      }

      this.#traceHandleStacks_ = [...groupMap.entries()].map(
        ([stack, handles]) => {
          // z-index sorting
          handles.sort(([, a], [, b]) => a - b);

          return <const>[stack, Uint32Array.from(handles.map((h) => h[0]))];
        },
      );

      // group sorting
      this.#traceHandleStacks_.sort(
        ([a], [b]) => (a ?? 10_000) - (b ?? 10_000),
      );
    }

    return this.#traceHandleStacks_;
  }

  #colorIndices_: lib.ResolvedColorIndices | undefined;
  get #colorIndices(): lib.ResolvedColorIndices {
    return (
      this.#colorIndices_ ??
      (this.#colorIndices_ =
        this.#params.precomputedColorIndices ??
        lib.ResolvedColorIndices.compute(
          this.#params.styles,
          this.#params.handles,
        ))
    );
  }

  get [LAZY]() {
    const self = this;
    return {
      get traceHandleStacks() {
        return self.#traceHandleStacks;
      },
      get handlesSet() {
        return self.#traceHandlesSet;
      },
      get colorIndices() {
        return self.#colorIndices;
      },
    };
  }

  withRandomSeed(seed: number | string): TraceList {
    return new TraceList({
      ...this.#params,
      randomSeed: hashAny(seed),
    });
  }

  /**
   * Create a new trace list with the same traces and identical range, but modified styles.
   */
  withStyle(styleSheet: TraceStyleSheet): TraceList {
    const patch = oxidizeStyleSheetPatch(styleSheet);

    return new TraceList({
      ...this.#params,
      styles: this.#params.styles.patch(patch),
    });
  }

  getStyle(traceId: string): ComputedTraceStyle {
    const style = this.#params.styles.get_computed(
      variantIds.getKey(traceId) ?? yeet(UnknownVariantIdError, traceId),
    );
    return {
      ...style,
      label: this.getLabel(traceId),
      color: this.getColor(traceId),
      "palette-index": this.#colorIndices.get_trace_index(
        variantIds.getKey(traceId)!,
      ),
    };
  }

  getColor(traceId: string): `#${string}` {
    return resolvedColorToHex(
      this.#params.styles.get_color(
        variantIds.getKey(traceId) ?? yeet(UnknownVariantIdError, traceId),
        this.#colorIndices,
        this.#params.randomSeed,
      ),
    );
  }

  /**
   * Create a new trace list with the same traces and styles, but limited to
   * the range provided. Traces and datapoints that are outside the range may
   * or may not be deleted – if you narrow down the range of a trace list and
   * than expand it again, don't expect you'll get back all the data.
   */
  withRange(range: ChartRange): TraceList {
    const bundles = this.#params.bundles.filter((bundle) => {
      const { from, to } = toNumericRange(range, bundle.xDataUnit);
      return bundle.boxed.intersects(from, to);
    });

    const availableHandles = new Set(flatMap(bundles, (b) => b.traces));
    const handles = this.#params.handles.filter((t) => availableHandles.has(t));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#params,
      handles,
      range,
      bundles,
    });
  }

  /**
   * Creates a new trace list with the same range and styles, but excluding
   * traces with the provided ids.
   */
  withoutTraces(tracesToExclude: Iterable<string>) {
    const exclude = pipe(
      map(tracesToExclude, (id) => variantIds.getKey(id)),
      (ids) => filter(ids, (n) => n !== undefined),
      (ids) => new Set(ids),
    );

    const handles = this.#params.handles.filter((h) => !exclude.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#params,
      handles,
    });
  }

  /**
   * Creates a new trace list with the same range and styles that
   * only contains traces with the provided ids.
   */
  withTraces(tracesToInclude: Iterable<string>) {
    const include = new Set(
      filter(
        map(tracesToInclude, (id) => variantIds.getKey(id)),
        (n): n is VariantHandle => n !== undefined,
      ),
    );

    const handles = this.#params.handles.filter((h) => include.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#params,
      handles,
    });
  }

  /**
   * Creates a new trace list with trace colors resolved to specific
   * colors, so that if you further modify the trace list, colors of
   * traces will not change
   */
  withResolvedColors() {
    return new TraceList({
      ...this.#params,
      precomputedColorIndices: this.#colorIndices,
    });
  }

  /**
   * Set trace labels by id
   */
  withLabels(newLabels: Iterable<[string, string | undefined]>) {
    const labels = new Map([
      ...this.#params.labels,
      ...filter(newLabels, (kv): kv is [string, string] => kv[1] !== undefined),
    ]);

    return new TraceList({
      ...this.#params,
      labels,
    });
  }

  getLabel(traceId: string): string | undefined {
    return this.#params.labels.get(traceId);
  }

  /**
   * Returns the ids of traces that have at least one datapoint
   * with y value larger than the given threshold value.
   */
  tracesLargerThanThreshold(thresholdValue: ChartValue): Set<string> {
    return new Set(
      flatMap(this.#params.bundles, (bundle) => {
        const filteredHandles = bundle.tracesOverThreshold(
          this.#params.handles,
          this.#params.range,
          thresholdValue,
        );
        return map(filteredHandles, (h) => variantIds.get(h)!);
      }),
    );
  }

  /**
   * Creates a new trace list by concatenating the provided trace lists together,
   * provided their data units are compatible with each other.
   * The resulting range will be a bounding interval of all the individual lists'
   * ranges. Each trace's style will be preserved – if a trace is present in multiple
   * lists, the style of its last occurrence will be preserved.
   */
  static union(...l: TraceList[]): TraceList {
    const lists = l.filter((t) => t.traceCount > 0);
    if (lists.length === 0) return TraceList.empty();

    // Validate Units
    assertAllUnitsCompatible(map(lists, (t) => t.xDataUnit));
    assertAllUnitsCompatible(map(lists, (t) => t.yDataUnit));
    const xDataUnit = lists[0].xDataUnit;
    const yDataUnit = lists[0].yDataUnit;

    // Unify Bundles, Handles & Labels
    const bundles = pipe(
      flatMap(lists, (l) => l.#params.bundles),
      unique,
      Array.from<Bundle>,
    );
    const handles = pipe(
      flatMap(lists, (l) => l.#params.handles),
      unique,
      (x) => new Uint32Array(x),
    );
    const labels = new Map(flatMap(lists, (l) => l.#params.labels.entries()));

    // Compute Range
    const allRangesArbitrary = lists.every((t) => t.#params.rangeArbitrary);
    // const anyRangeArbitrary = lists.some((t) => t.#p.rangeArbitrary);
    const ignoreArbitraryRanges = !allRangesArbitrary;

    const ranges = lists.flatMap((t) => {
      if (ignoreArbitraryRanges && t.#params.rangeArbitrary) return [];
      else return [toNumericRange(t.range, xDataUnit)];
    });

    const from = fold(
      map(ranges, (r) => r.from),
      Math.min,
      Infinity,
    );
    const to = fold(
      map(ranges, (r) => r.to),
      Math.max,
      -Infinity,
    );
    const range = toChartRange({ from, to }, xDataUnit);
    const rangeArbitrary = allRangesArbitrary;

    // Compute Styles
    // beware: mutating `lists`!
    const first = lists.pop()!;
    const styleBuilder = new lib.TraceStyleSheetUnionBuilder(
      first.#params.styles,
    );
    for (const next of lists) {
      styleBuilder.add(next.#params.handles, next.#params.styles);
    }
    const styles = styleBuilder.collect();

    return new TraceList({
      handles,
      range,
      rangeArbitrary,
      bundles,
      labels,
      styles,
      xDataUnit,
      yDataUnit,

      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  #statistics: TraceStatistics[] | undefined;

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

    from ??= this.range.from;
    to ??= this.range.to;
    const range = { from, to } as ChartRange;

    const handles = traces
      ? Uint32Array.from(traces.map((id) => variantIds.getKey(id)!))
      : this.#params.handles;

    const counter = new lib.MetaCounter(handles.length);

    for (const bundle of this.#params.bundles) {
      const bundleRange = bundle.rangeInView(range).inBundleUnits();
      const factor = unitConversionFactor(bundle.yDataUnit, this.yDataUnit);
      counter.add_bundle(bundle.boxed, handles, bundleRange, factor);
    }

    const metas: lib.TraceMetas[] = counter.to_array();
    const withYUnit = (v: number) => toChartValue(v, this.yDataUnit);

    const convertedMetas = Array.from(
      map(
        zip(metas, handles),
        ([meta, handle]): TraceStatistics => ({
          traceId: variantIds.get(handle)!,
          min: withYUnit(meta.min),
          max: withYUnit(meta.max),
          average: withYUnit(meta.avg),
          averageNonzero: withYUnit(meta.avgNz),
        }),
      ),
    );

    if (unfiltered) this.#statistics = convertedMetas;
    return convertedMetas;
  }

  #yRange: ChartRange | undefined;
  /**
   * Calculate the y axis range of this trace list.
   */
  getYRange(xRange?: ChartRange, includeConstantBundles = true): ChartRange {
    if (this.#yRange && xRange === undefined) return this.#yRange;
    const { getStackData, freeStackData } = this.stackHelper(
      this.#params.bundles.filter(
        (b) => includeConstantBundles || b.boxed.range().type !== "Everywhere",
      ),
    );

    const range = this[LAZY].traceHandleStacks.reduce<ChartRange | undefined>(
      (prev, [stack, handles]) => {
        const { bundles, factors, xUnit, yUnit } = getStackData();
        const range = toNumericRange(xRange ?? this.range, xUnit);

        const yRange =
          stack === null
            ? lib.find_list_extents(bundles, factors, handles, range)
            : lib.find_stack_extents(bundles, factors, handles, range);

        const [from, to] = [yRange.from, yRange.to].map((v) =>
          toChartValue(v, yUnit),
        );

        if (prev === undefined) return { from, to } as ChartRange;

        prev.from = minValue(prev.from, from);
        prev.to = maxValue(prev.to, to);

        return prev;
      },
      undefined,
    );

    freeStackData();

    return range ?? { from: 0, to: 1 };
  }

  /**
   * Finds the specified number of traces that are the closest to input point.
   * The point has to be im data's natural units
   * By default, the distance is measured only in the vertical direction (ie. you'll
   * only get trace points which are exactly below or above the reference point).
   */
  findNearestTraces(
    point: { x: ChartValue; y: ChartValue },
    howMany: number,
    interpolation: InterpolationStrategy,
  ): {
    traceId: string;
    x: ChartValue;
    y: ChartValue;
    displayY: ChartValue;
  }[] {
    const yToNum = (y: ChartValue) => toNumeric(y, this.yDataUnit);

    let closestPoints: Array<{
      handle: VariantHandle;
      x: ChartValue;
      y: ChartValue;
      displayY: ChartValue;
      dist: number;
    }> = [];

    const intersecting = this.#params.bundles.filter((b) => {
      const x = toNumeric(point.x, b.xDataUnit);

      return b.boxed.contains_point(x);
    });

    if (intersecting.length === 0) return [];

    const { getStackData, freeStackData } = this.stackHelper(intersecting);

    for (const [stack, handles] of this[LAZY].traceHandleStacks) {
      if (stack === null) {
        for (const bundle of intersecting) {
          const bundleTraces = new Uint32Array(
            intersection(bundle.traces, new Set(handles)),
          );
          const pts = bundle.findClosestTraces(
            bundleTraces,
            point,
            howMany,
            interpolation,
          );

          for (const p of pts) {
            const dist = yToNum(p.dist);
            closestPoints.push({ ...p, dist });
          }
        }
      } else {
        const { bundles, factors, xUnit, yUnit } = getStackData();

        const x = toNumeric(point.x, xUnit);
        const y = toNumeric(point.y, yUnit);

        // stacked traces
        const p = lib.find_closest_in_stack(
          bundles,
          factors,
          handles,
          howMany,
          x,
          y,
          interpolation,
        ) as lib.TracePoint[];

        p.forEach((p) => {
          closestPoints.push({
            handle: p.handle,
            x: toChartValue(p.x, xUnit),
            y: toChartValue(p.y, yUnit),
            displayY: toChartValue(p.displayY, yUnit),
            dist: p.dist,
          });
        });
      }
    }

    freeStackData();

    // leave only the requested number of closest points
    closestPoints.sort((a, b) => a.dist - b.dist);
    closestPoints = closestPoints.slice(0, howMany);

    return closestPoints.map(({ handle, x, y, displayY }) => ({
      traceId: variantIds.get(handle)!,
      x,
      y,
      displayY,
    }));
  }

  stackHelper = (bundles: Bundle[]) => {
    let _stackData:
      | {
          xUnit: DataUnit;
          yUnit: DataUnit;
          bundles: lib.BundleVec;
          factors: Float64Array;
        }
      | undefined;

    const getStackData = () => {
      if (!_stackData) {
        const first = bundles.at(0)!;
        const bundleVec = new lib.BundleVec();
        const factors: number[] = [];

        bundles.forEach((b) => {
          bundleVec.push(b.boxed);
          if (isUnit(first.yDataUnit) && isUnit(b.yDataUnit)) {
            factors.push(
              (b.yDataUnit as Unit).conversionFactorTo(first.yDataUnit as Unit),
            );
          } else {
            factors.push(1);
          }
        });

        _stackData = {
          bundles: bundleVec,
          factors: Float64Array.from(factors),
          xUnit: first.xDataUnit,
          yUnit: first.yDataUnit,
        };
      }

      return _stackData;
    };

    return {
      getStackData,
      freeStackData: () => {
        if (_stackData) _stackData.bundles.free();
      },
    };
  };

  /**
   * Creates an iterator that goes over all the available trace data.
   */
  exportData(opts: TraceListExportOptions = {}): IterableIterator<ExportRow> {
    return exportTraceListData(this, opts);
  }
}
