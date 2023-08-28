import type { Range, TraceHandle } from "../types";
import { lib } from "./wasm";
import { computeStyles, type TraceStylesheet } from "./trace-styles";
import { yeet } from "../../utils/yeet";
import { UnknownTraceHandleError } from "../errors";
import { traceIds } from "./controller";
import {
  concat,
  filter,
  flatMap,
  map,
  reduce,
  unique,
  zip,
} from "../../utils/collection";
import { merge } from "lodash-es";
import { proxyMarker } from "comlink";
import type { Color } from "../../utils/color";

export const BUNDLES = Symbol("bundles");
export const HANDLES = Symbol("handles");

export interface StyledTrace {
  id: string;
  width: number;
  color: Color;
  display: "line" | "points";
}

export class TraceList {
  [proxyMarker] = true;

  #traceHandles: TraceHandle[];
  #bundles: lib.BoxedBundle[];
  #metas: lib.TraceMetas[] | undefined;
  #stylesheet: TraceStylesheet;
  #range: Range;

  constructor(
    handles: TraceHandle[],
    range: Range,
    bundles: lib.BoxedBundle[],
    stylesheet: TraceStylesheet
  ) {
    this.#traceHandles = handles;
    this.#range = range;
    this.#bundles = bundles;
    this.#stylesheet = stylesheet;
  }

  get range(): Range {
    return { ...this.#range };
  }

  get stylesheet(): TraceStylesheet {
    return structuredClone(this.#stylesheet);
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

  tracesWithStyles(): Iterable<StyledTrace> {
    const ids = this.traces();
    const styles = computeStyles(
      this.#stylesheet,
      this.#traceHandles,
      traceIds
    );

    return map(zip(ids, styles), ([id, { color, width, points_mode }]) => ({
      id,
      color,
      width,
      display: points_mode ? "points" : "line",
    }));
  }

  get [BUNDLES]() {
    return this.#bundles;
  }
  get [HANDLES]() {
    return this.#traceHandles;
  }

  withStyle(stylesheet: TraceStylesheet): TraceList {
    return new TraceList(
      this.#traceHandles,
      this.#range,
      this.#bundles,
      merge(this.stylesheet, stylesheet)
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

    return new TraceList(handles, { from, to }, bundles, this.#stylesheet);
  }

  withoutTraces(tracesToExclude: Iterable<string>) {
    const exclude = new Set(
      filter(
        map(tracesToExclude, (id) => traceIds.getKey(id)),
        (n): n is TraceHandle => n !== undefined
      )
    );

    const handles = this.#traceHandles.filter((h) => !exclude.has(h));

    return new TraceList(handles, this.#range, this.#bundles, this.#stylesheet);
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

    const stylesheet = reduce(
      map(lists, (l) => l.stylesheet),
      merge
    );

    return new TraceList(handles, { from, to }, bundles, stylesheet);
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
}
