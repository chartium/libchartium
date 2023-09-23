import type { Point, Range, TraceHandle, Unit } from "../types";
import { lib } from "./wasm";
import {
  computeTraceColor,
  defaultStyle,
  resolveTraceInfo,
  type ResolvedTraceInfo,
  type TraceStyle,
  type TraceStylesheet,
  type TraceDataUnits,
  simplifyTraceInfo,
} from "./trace-styles";
import { yeet } from "../../utils/yeet";
import { UnknownTraceHandleError } from "../errors";
import { traceIds } from "./controller";
import {
  filter,
  flatMap,
  map,
  reduce,
  some,
  unique,
} from "../../utils/collection";
import { proxyMarker } from "comlink";
import type { Color } from "../../utils/color";

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
   * Create a new trace list with the same traces and identical range, but modified styles.
   */
  withStyle(stylesheet: TraceStylesheet): TraceList {
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
  withRange({ from, to }: Range): TraceList {
    const bundles = this.#bundles.filter((bundle) =>
      bundle.intersects(from, to)
    );

    const availableHandles = new Set(
      flatMap(bundles, (b) => b.traces() as Iterable<TraceHandle>)
    );
    const handles = this.#traceHandles.filter((t) => availableHandles.has(t));

    return new TraceList(handles, { from, to }, bundles, this.#traceInfo);
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
  }: Partial<{ traces: string[]; from: number; to: number }> = {}) {
    const unfiltered =
      from === undefined && to === undefined && traces === undefined;

    if (unfiltered && this.#statistics) return this.#statistics;

    const handles = traces
      ? Uint32Array.from(traces.map((id) => traceIds.getKey(id)!))
      : Uint32Array.from(this.#traceHandles);

    const counter = new lib.MetaCounter(handles.length);

    for (const bundle of this.#bundles) {
      const a = Math.max(from ?? bundle.from(), bundle.from());
      const b = Math.min(to ?? bundle.to(), bundle.to());
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
    return {
      from: metas.reduce(
        (prev, { min: curr }) => Math.min(prev, curr),
        metas[0].min
      ),
      to: metas.reduce(
        (prev, { max: curr }) => Math.max(prev, curr),
        metas[0].max
      ),
    };
  }

  #units: ReturnType<typeof this.getUnits> | undefined;
  /**
   * List all the data units present in this trace list.
   *
   * By default, uploaded data have no units (`undefined`), however you can
   * set them using the `withDataUnits` method. If you make a union of
   * trace lists with different units, you will get a mixed units list.
   *
   * Take care when rendering a trace list with mixed units – if you
   * aren't intentional with it, you may get unexpected results.
   */
  getUnits(): { x: (Unit | undefined)[]; y: (Unit | undefined)[] } {
    if (this.#units) return this.#units;
    const xUnits = new Set<Unit | undefined>();
    const yUnits = new Set<Unit | undefined>();

    const addUnique = (
      set: Set<Unit | undefined>,
      value: Unit | undefined
    ): void => {
      if (!value) return void set.add(value);
      if (some(set, (u) => u?.isEqual(value) ?? false)) return;
      set.add(value);
    };

    for (const trace of this.traces()) {
      const { xDataUnit, yDataUnit } = this.getTraceInfo(trace);
      addUnique(xUnits, xDataUnit);
      addUnique(yUnits, yDataUnit);
    }

    this.#units = { x: Array.from(xUnits), y: Array.from(yUnits) };
    return this.#units;
  }

  /**
   * Finds the specified number of traces that are the closest to input point.
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
