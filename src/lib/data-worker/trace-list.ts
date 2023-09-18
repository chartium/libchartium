import type { Point, Range, TraceHandle, Unit } from "../types";
import { lib } from "./wasm";
import {
  computeStyles,
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
import { filter, flatMap, map, reduce, unique } from "../../utils/collection";
import { merge } from "lodash-es";
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
  #metas: lib.TraceMetas[] | undefined;
  #traceInfo: ResolvedTraceInfo;
  #range: Range;

  constructor(
    handles: TraceHandle[],
    range: Range,
    bundles: lib.BoxedBundle[],
    traceInfo: ResolvedTraceInfo
  ) {
    this.#traceHandles = handles;
    this.#range = range;
    this.#bundles = bundles;
    this.#traceInfo = traceInfo;
  }

  get range(): Range {
    return { ...this.#range };
  }

  get traceCount(): number {
    return this.#traceHandles.length;
  }

  *traces(): Iterable<string> {
    for (const handle of this.#traceHandles) {
      const id = traceIds.get(handle as TraceHandle);
      yield id ?? yeet(UnknownTraceHandleError, handle);
    }
  }

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

  withStyle(stylesheet: TraceStylesheet): TraceList {
    return new TraceList(this.#traceHandles, this.#range, this.#bundles, [
      ...resolveTraceInfo(stylesheet, this.#traceHandles, traceIds),
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

  calculateMetas({
    traces,
    from,
    to,
  }: Partial<{ traces: string[]; from: number; to: number }> = {}) {
    const unfiltered =
      from === undefined && to === undefined && traces === undefined;

    if (unfiltered && this.#metas) return this.#metas;

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
    if (unfiltered) this.#metas = metas;
    return metas;
  }

  /** Finds n traces that are the closest to input point */
  findClosestTracesToPoint(
    point: Point,
    n: number
  ):
    | {
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
        n
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
      closestPoints = closestPoints.slice(0, n);
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
