import type { Point, Quantity, Range, TraceHandle, Unit } from "../types.js";
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
import { yeet } from "../utils/yeet.js";
import { UnknownTraceHandleError } from "../errors.js";
import { traceIds } from "./controller.js";
import {
  filter,
  flatMap,
  map,
  reduce,
  some,
  unique,
} from "../utils/collection.js";
import { proxyMarker } from "comlink";
import type { Color } from "../utils/color.js";
import { toNumeric, toNumericRange } from "../utils/quantityHelpers.js";

export const BUNDLES = Symbol("bundles");
export const HANDLES = Symbol("handles");
export const TRACE_INFO = Symbol("trace info");

export interface TraceInfo {
  id: string;

  width: number;
  color: Color;
  display: "line" | "points";

  xDataUnit: Unit | undefined;
  yDataUnit: Unit | undefined;
}

export class TraceList {
  [proxyMarker] = true;

  #traceHandles: TraceHandle[];
  #bundles: lib.BoxedBundle[];
  #statistics: lib.TraceMetas[] | undefined;
  #traceInfo: ResolvedTraceInfo;
  #range: Range;

  constructor(
    handles: TraceHandle[],
    range: Range,
    bundles: lib.BoxedBundle[],
    traceInfo: ResolvedTraceInfo | null
  ) {
    this.#traceHandles = handles;
    this.#range = range;
    this.#bundles = bundles;
    this.#traceInfo = traceInfo ?? resolveTraceInfo({}, [], handles, traceIds);
  }

  static empty() {
    return new TraceList([], { from: 0, to: 0 }, [], []);
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

  /**
   * Returns units that traces of input bundle use
   */
  getBundleUnits(bundle: lib.BoxedBundle): {
    x: Unit | undefined;
    y: Unit | undefined;
  } {
    const traceId = traceIds.get(bundle.traces()[0] as TraceHandle)!;
    const { xDataUnit, yDataUnit } = this.getTraceInfo(traceId);
    return { x: xDataUnit, y: yDataUnit };
  }

  /**
   * Create a new trace list with the same traces and identical range, but modified styles.
   */
  withStyle(stylesheet: TraceStylesheet): TraceList {
    console.log("from this.#traceInfo", this.#traceInfo);
    console.log("from ...resolveTraceInfo(this.#traceInfo)", [
      ...resolveTraceInfo(
        stylesheet,
        this.#traceInfo,
        this.#traceHandles,
        traceIds
      ),
    ]);
    return new TraceList(this.#traceHandles, this.#range, this.#bundles, [
      ...resolveTraceInfo(
        stylesheet,
        this.#traceInfo,
        this.#traceHandles,
        traceIds
      ),
    ]);
  }

  /**
   * Set the units of all data in this trace list. This function doesn't do
   * any unit conversions, nor does it modify the data – rather, it re-interprets
   * the stored data as if it always had these units.
   */
  withDataUnits(newUnits: { x?: Unit; y?: Unit }) {
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

    return new TraceList(
      this.#traceHandles,
      this.#range,
      this.#bundles,
      traceInfo
    );
  }

  /**
   * Create a new trace list with the same traces and styles, but limited to
   * the range provided. Traces and datapoints that are outside the range may
   * or may not be deleted – if you narrow down the range of a trace list and
   * than expand it again, don't expect you'll get back all the data.
   */
  withRange(range: Range): TraceList {
    let bundles: lib.BoxedBundle[] = [];
    for (const [units, traces] of this.getUnitsToTraceMap()) {
      const { from, to } = toNumericRange(range, units.x);
      const theseBundles = traces.#bundles;
      bundles.push(
        ...theseBundles.filter((bundle) => bundle.intersects(from, to))
      );
    }

    const availableHandles = new Set(
      flatMap(bundles, (b) => b.traces() as Iterable<TraceHandle>)
    );
    const handles = this.#traceHandles.filter((t) => availableHandles.has(t));

    return new TraceList(handles, range, bundles, this.#traceInfo);
  }

  /**
   * Creates a new trace list with the same range and styles, but excluding
   * traces with the provided ids.
   */
  withoutTraces(tracesToExclude: Iterable<string>) {
    const exclude = new Set(
      filter(
        map(tracesToExclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined
      )
    );

    const handles = this.#traceHandles.filter((h) => !exclude.has(h));

    return new TraceList(handles, this.#range, this.#bundles, this.#traceInfo);
  }

  /**
   * Creates a new trace list with the same range and styles that
   * only contains traces with the provided ids.
   */
  withTraces(tracesToInclude: Iterable<string>) {
    const include = new Set(
      filter(
        map(tracesToInclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined
      )
    );

    const handles = this.#traceHandles.filter((h) => include.has(h));

    return new TraceList(handles, this.#range, this.#bundles, this.#traceInfo);
  }

  /**
   * Creates a new trace list by concatenating the provided trace lists together.
   * The resulting range will be a bounding interval of all the individual lists'
   * ranges. Each trace's style will be preserved – if a trace is present in multiple
   * lists, style of its first occurence will be preserved.
   */
  static union(...lists: TraceList[]): TraceList {
    const bundles = Array.from(unique(flatMap(lists, (l) => l[BUNDLES])));
    const handles = Array.from(unique(flatMap(lists, (l) => l[HANDLES])));

    const from = reduce(
      map(bundles, (b) => b.from()),
      Math.min
    );
    const to = reduce(
      map(bundles, (b) => b.to()),
      Math.max
    );
    const info = simplifyTraceInfo(
      lists.flatMap((l) => l.#traceInfo),
      handles,
      traceIds
    );

    return new TraceList(handles, { from, to }, bundles, info);
  }

  /**
   * Calculate the statistics (like the maximum, minimum and average value)
   * for the provided traces on the provided range. If parameters are ommited,
   * it will use all traces and the entire range of this trace list.
   */
  calculateStatistics({
    traces,
    from,
    to,
  }: Partial<{
    traces: string[];
    from: number | Quantity;
    to: number | Quantity;
  }> = {}) {
    const unfiltered =
      from === undefined && to === undefined && traces === undefined;

    if (unfiltered && this.#statistics) return this.#statistics;

    const handles = traces
      ? Uint32Array.from(traces.map((id) => traceIds.getKey(id)!))
      : Uint32Array.from(this.#traceHandles);

    const counter = new lib.MetaCounter(handles.length);

    for (const bundle of this.#bundles) {
      const xUnit = this.getBundleUnits(bundle).x;
      const a = Math.max(
        from ? toNumeric(from, xUnit) : bundle.from(),
        bundle.from()
      );
      const b = Math.min(to ? toNumeric(to, xUnit) : bundle.to(), bundle.to());
      if (a >= b) continue;

      counter.add_bundle(bundle, handles, a, b);
    }

    const metas: lib.TraceMetas[] = counter.to_array();
    if (unfiltered) this.#statistics = metas;
    return metas;
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
        (prev, { min: curr }) => Math.min(prev, curr),
        metas[0].min // FIXME needs uuuns (units)
      ),
      to: metas.reduce(
        (prev, { max: curr }) => Math.max(prev, curr),
        metas[0].max // FIXME needs uuuns (units)
      ),
    };
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
  getUnits(): { x: Unit | undefined; y: Unit | undefined }[] {
    if (this.#units) return this.#units;
    const units = new Set<{ x: Unit | undefined; y: Unit | undefined }>();

    const addUnique = (
      set: Set<{ x: Unit | undefined; y: Unit | undefined }>,
      value: { x: Unit | undefined; y: Unit | undefined }
    ): void => {
      const alreadyRecorded = some(set, (u) => {
        console.log("u.x", u.x);
        console.log("u.x?.isEqual");
        const xMatch =
          value.x !== undefined
            ? u.x?.isEqual(value.x) ?? false
            : value.x === u.x;
        const yMatch =
          value.y !== undefined
            ? u.y?.isEqual(value.y) ?? false
            : value.y === u.y;

        return xMatch && yMatch;
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
    { x: Unit | undefined; y: Unit | undefined },
    TraceList // FIXME do we want tracelist here or ids?
  > {
    if (this.#unitsToTraceMap) return this.#unitsToTraceMap;

    let toReturn = new Map<
      { x: Unit | undefined; y: Unit | undefined },
      TraceList
    >();
    for (const bundle of this.#bundles) {
      const { x, y } = this.getBundleUnits(bundle);
      const newTraceList = new TraceList(
        Array.from(bundle.traces()) as TraceHandle[],
        this.#range,
        [bundle],
        this.#traceInfo
      );
      if (toReturn.has({ x, y })) {
        toReturn.set(
          { x, y },
          TraceList.union(toReturn.get({ x, y })!, newTraceList)
        );
      } else toReturn.set({ x, y }, newTraceList);
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
    point: Point,
    howMany: number
  ): {
    traceInfo: TraceInfo;
    closestPoint: Point;
  }[] {
    // FIXME make TraceList auto update its ranges based on ranges of bundles

    interface FoundPoint {
      handle: TraceHandle;
      point: Point;
      distance: number;
    }

    let closestPoints: FoundPoint[] = [];

    for (const bundle of this.#bundles) {
      const foundPoints = bundle.find_n_closest_points(
        new Uint32Array(this.#traceHandles),
        point.x,
        point.y,
        howMany
      );

      for (const foundPoint of foundPoints) {
        const distance = Math.sqrt(
          (foundPoint.x - point.x) ** 2 + (foundPoint.y - point.y) ** 2
        );
        closestPoints.push({
          handle: foundPoint.handle as TraceHandle,
          point: { x: foundPoint.x, y: foundPoint.y } as Point,
          distance,
        });
      }

      closestPoints.sort((a, b) => a.distance - b.distance);
      closestPoints = closestPoints.slice(0, howMany);
    }

    if (closestPoints.length === 0) {
      return [];
    }
    0;
    let results: {
      traceInfo: TraceInfo;
      closestPoint: Point;
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
}
