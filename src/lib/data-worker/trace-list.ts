import {
  type Range,
  type TraceHandle,
  type ChartValue,
  type DataUnit,
  type TraceHandleArray,
  Unit,
} from "../types.js";
import { lib } from "./wasm.js";
import {
  oxidizeStyleSheetPatch,
  type TraceStyleSheet,
} from "./trace-styles.js";
import { yeet } from "yeet-ts";
import { UnknownTraceHandleError, UnknownTraceIdError } from "../errors.js";
import { traceIds } from "./controller.js";
import {
  filter,
  flatMap,
  intersection,
  map,
  reduce,
  unique,
  zip,
} from "../utils/collection.js";
import {
  maxValue,
  minValue,
  toNumeric,
  toNumericRange,
  toChartValue,
  toRange,
  assertAllUnitsCompatible,
  unitConversionFactor,
} from "../utils/unit.js";
import {
  exportTraceListData,
  type TraceListExportOptions,
} from "./trace-export.js";
import type { Bundle } from "./bundle.js";
import { resolvedColorToHex } from "../utils/color.js";
import { hashAny } from "../utils/hash.js";
import type { InterpolationStrategy } from "../../../dist/wasm/libchartium.js";
import { isUnit } from "unitlib";

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

export interface TraceListParams {
  handles: TraceHandleArray;
  bundles: Bundle[];
  range: Range;
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
  #p: Readonly<TraceListParams>;
  private constructor(params: TraceListParams) {
    this.#p = params;
  }
  get [PARAMS]() {
    return this.#p;
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
   * The x axis range this trace list is limited to.
   */
  get range(): Range {
    return { ...this.#p.range };
  }

  /**
   * The number of traces in this trace list.
   */
  get traceCount(): number {
    return this.#p.handles.length;
  }

  get xDataUnit(): DataUnit {
    return this.#p.xDataUnit;
  }
  get yDataUnit(): DataUnit {
    return this.#p.yDataUnit;
  }

  get randomSeed(): number {
    return this.#p.randomSeed;
  }

  /**
   * An iterable containing all the trace ids of this list.
   */
  *traces(): Iterable<string> {
    for (const handle of this.#p.handles) {
      const id = traceIds.get(handle as TraceHandle);
      yield id ?? yeet(UnknownTraceHandleError, handle);
    }
  }

  #traceHandleSet_: Set<TraceHandle> | undefined;
  get #traceHandlesSet(): Set<TraceHandle> {
    if (!this.#traceHandleSet_)
      this.#traceHandleSet_ = new Set(this.#p.handles);
    return this.#traceHandleSet_;
  }

  #traceHandleStacks_: [null | number, Uint32Array][] | undefined;
  get #traceHandleStacks(): [null | number, Uint32Array][] {
    if (!this.#traceHandleStacks_) {
      const groupMap = new Map<null | number, [TraceHandle, number][]>();
      const getStack = (v: lib.TraceStyle["stack-group"]) => {
        if (v === "unset") return null;

        return v;
      };

      for (const handle of this.#p.handles) {
        const style = this.#p.styles.get_cloned(handle);
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
        this.#p.precomputedColorIndices ??
        lib.ResolvedColorIndices.compute(this.#p.styles, this.#p.handles))
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
      ...this.#p,
      randomSeed: hashAny(seed),
    });
  }

  /**
   * Create a new trace list with the same traces and identical range, but modified styles.
   */
  withStyle(styleSheet: TraceStyleSheet): TraceList {
    const patch = oxidizeStyleSheetPatch(styleSheet);

    return new TraceList({
      ...this.#p,
      styles: this.#p.styles.patch(patch),
    });
  }

  getStyle(traceId: string): ComputedTraceStyle {
    const style = this.#p.styles.get_computed(
      traceIds.getKey(traceId) ?? yeet(UnknownTraceIdError, traceId),
    );
    return {
      ...style,
      label: this.getLabel(traceId),
      color: this.getColor(traceId),
      "palette-index": this.#colorIndices.get_trace_index(
        traceIds.getKey(traceId)!,
      ),
    };
  }

  getColor(traceId: string): `#${string}` {
    return resolvedColorToHex(
      this.#p.styles.get_color(
        traceIds.getKey(traceId) ?? yeet(UnknownTraceIdError, traceId),
        this.#colorIndices,
        this.#p.randomSeed,
      ),
    );
  }

  /**
   * Create a new trace list with the same traces and styles, but limited to
   * the range provided. Traces and datapoints that are outside the range may
   * or may not be deleted – if you narrow down the range of a trace list and
   * than expand it again, don't expect you'll get back all the data.
   */
  withRange(range: Range): TraceList {
    const bundles = this.#p.bundles.filter((bundle) => {
      const { from, to } = toNumericRange(range, bundle.xDataUnit);
      return bundle.boxed.intersects(from, to);
    });

    const availableHandles = new Set(flatMap(bundles, (b) => b.traces));
    const handles = this.#p.handles.filter((t) => availableHandles.has(t));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#p,
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
    const exclude = new Set(
      filter(
        map(tracesToExclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined,
      ),
    );

    const handles = this.#p.handles.filter((h) => !exclude.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#p,
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
        map(tracesToInclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined,
      ),
    );

    const handles = this.#p.handles.filter((h) => include.has(h));
    if (handles.length === 0) return TraceList.empty();

    return new TraceList({
      ...this.#p,
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
      ...this.#p,
      precomputedColorIndices: this.#colorIndices,
    });
  }

  /**
   * Set trace labels by id
   */
  withLabels(newLabels: Iterable<[string, string | undefined]>) {
    const labels = new Map([
      ...this.#p.labels,
      ...filter(newLabels, (kv): kv is [string, string] => kv[1] !== undefined),
    ]);

    return new TraceList({
      ...this.#p,
      labels,
    });
  }

  getLabel(traceId: string): string | undefined {
    return this.#p.labels.get(traceId);
  }

  /**
   * Returns the ids of traces that have at least one datapoint
   * with y value larger than the given threshold value.
   */
  tracesLargerThanThreshold(thresholdValue: ChartValue): Set<string> {
    return new Set(
      flatMap(this.#p.bundles, (bundle) => {
        const filteredHandles = bundle.tracesOverThreshold(
          this.#p.handles,
          this.#p.range,
          thresholdValue,
        );
        return map(filteredHandles, (h) => traceIds.get(h)!);
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
    const bundles = Array.from(unique(flatMap(lists, (l) => l.#p.bundles)));
    const handles = new Uint32Array(
      unique(flatMap(lists, (l) => l.#p.handles)),
    );
    const labels = new Map(flatMap(lists, (l) => l.#p.labels.entries()));

    // Compute Range
    const allRangesArbitrary = lists.every((t) => t.#p.rangeArbitrary);
    // const anyRangeArbitrary = lists.some((t) => t.#p.rangeArbitrary);
    const ignoreArbitraryRanges = !allRangesArbitrary;

    const ranges = lists.flatMap((t) => {
      if (ignoreArbitraryRanges && t.#p.rangeArbitrary) return [];
      else return [toNumericRange(t.range, xDataUnit)];
    });

    const from = reduce(
      map(ranges, (r) => r.from),
      Math.min,
    );
    const to = reduce(
      map(ranges, (r) => r.to),
      Math.max,
    );
    const range = toRange({ from, to }, xDataUnit);
    const rangeArbitrary = allRangesArbitrary;

    // Compute Styles
    // beware: mutating `lists`!
    const first = lists.pop()!;
    const styleBuilder = new lib.TraceStyleSheetUnionBuilder(first.#p.styles);
    for (const next of lists) {
      styleBuilder.add(next.#p.handles, next.#p.styles);
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
    const range = { from, to } as Range;

    const handles = traces
      ? Uint32Array.from(traces.map((id) => traceIds.getKey(id)!))
      : this.#p.handles;

    const counter = new lib.MetaCounter(handles.length);

    for (const bundle of this.#p.bundles) {
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
          traceId: traceIds.get(handle)!,
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

  #yRange: Range | undefined;
  /**
   * Calculate the y axis range of this trace list.
   */
  getYRange(): Range {
    if (this.#yRange) return this.#yRange;

    const { getStackData, freeStackData } = this.stackHelper(this.#p.bundles);

    const range = this[LAZY].traceHandleStacks.reduce<Range | undefined>(
      (prev, [stack, handles]) => {
        const { bundles, factors, xUnit, yUnit } = getStackData();
        const range = toNumericRange(this.range, xUnit);

        const yRange =
          stack === null
            ? lib.find_list_extents(bundles, factors, handles, range)
            : lib.find_stack_extents(bundles, factors, handles, range);

        const [from, to] = [yRange.from, yRange.to].map((v) =>
          toChartValue(v, yUnit),
        );

        if (prev === undefined) return { from, to } as Range;

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
  }[] {
    const yToNum = (y: ChartValue) => toNumeric(y, this.yDataUnit);

    let closestPoints: Array<{
      handle: TraceHandle;
      x: ChartValue;
      y: ChartValue;
      distance: number;
    }> = [];

    const intersecting = this.#p.bundles.filter((b) => {
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
            const distance = Math.abs(yToNum(point.y) - yToNum(p.y));
            closestPoints.push({ ...p, distance });
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
          x,
          y,
          interpolation,
        ) as lib.TracePoint | undefined;

        if (p) {
          closestPoints = [
            {
              x: toChartValue(p.x, xUnit),
              y: toChartValue(p.y, yUnit),
              handle: p.handle,
              distance: 0,
            },
          ];
          break;
        }
      }
    }

    freeStackData();

    // leave only the requested number of closest points
    closestPoints.sort((a, b) => a.distance - b.distance);
    closestPoints = closestPoints.slice(0, howMany);

    return closestPoints.map(({ handle, x, y }) => ({
      traceId: traceIds.get(handle)!,
      x,
      y,
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
