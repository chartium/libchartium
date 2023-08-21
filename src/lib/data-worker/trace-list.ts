import type { Range, TraceHandle } from "../types";
import { lib } from "./wasm";
import type { TraceStylesheet } from "./trace-styles";
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
} from "../../utils/collection";
import { merge } from "lodash-es";

export const BUNDLES = Symbol("bundles");
export const HANDLES = Symbol("handles");
export const EXCLUDE = Symbol("exclude");

export class TraceList {
  #traceHandles: TraceHandle[];
  #excludedTraces: Set<TraceHandle>;
  #bundles: lib.BoxedBundle[];
  #metas: lib.TraceMetas[] | undefined;
  #stylesheet: TraceStylesheet;
  #range: Range;

  constructor(
    handles: TraceHandle[],
    exclude: Set<TraceHandle>,
    range: Range,
    bundles: lib.BoxedBundle[],
    stylesheet: TraceStylesheet
  ) {
    this.#traceHandles = handles;
    this.#excludedTraces = exclude;
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

  get [BUNDLES]() {
    return this.#bundles;
  }
  get [HANDLES]() {
    return this.#traceHandles;
  }
  get [EXCLUDE]() {
    return this.#excludedTraces;
  }

  withStyle(stylesheet: TraceStylesheet): TraceList {
    return new TraceList(
      this.#traceHandles,
      this.#excludedTraces,
      this.#range,
      this.#bundles,
      {
        ...this.stylesheet,
        ...stylesheet,
      }
    );
  }

  withRange({ from, to }: Range): TraceList {
    const bundles = this.#bundles.filter((bundle) =>
      bundle.intersects(from, to)
    );

    const currentHandles = new Set(this.#traceHandles);
    const availableHandles = new Set(
      flatMap(bundles, (b) => b.traces() as Iterable<TraceHandle>)
    );
    const handles = this.#traceHandles.filter((t) => availableHandles.has(t));
    const exclude = new Set<TraceHandle>(
      filter(availableHandles, (t) => !currentHandles.has(t))
    );

    return new TraceList(
      handles,
      exclude,
      { from, to },
      bundles,
      this.#stylesheet
    );
  }

  withoutTraces(traces: Iterable<string>) {
    const availableHandles = new Set(this.#traceHandles);

    const exclude = new Set(
      concat(
        this.#excludedTraces,
        filter(
          filter(
            map(traces, (id) => traceIds.getKey(id)),
            (n): n is TraceHandle => n !== undefined
          ),
          (h) => availableHandles.has(h)
        )
      )
    );

    const handles = this.#traceHandles.filter((h) => !exclude.has(h));

    return new TraceList(
      handles,
      exclude,
      this.#range,
      this.#bundles,
      this.#stylesheet
    );
  }

  static union(...lists: TraceList[]): TraceList {
    const bundles = Array.from(unique(flatMap(lists, (l) => l[BUNDLES])));

    const availableHandles = new Set(
      flatMap(bundles, (b) => b.traces() as Iterable<TraceHandle>)
    );
    const handlesSet = new Set<TraceHandle>();
    const handles = Array.from(
      unique(
        flatMap(lists, (l) => l[HANDLES]),
        handlesSet
      )
    );
    const exclude = new Set(
      filter(availableHandles, (h) => !handlesSet.has(h))
    );

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

    return new TraceList(handles, exclude, { from, to }, bundles, stylesheet);
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
