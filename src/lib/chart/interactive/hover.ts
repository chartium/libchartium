import {
  Defer,
  derived,
  type DeferLike,
  type Signal,
  type WritableSignal,
} from "@mod.js/signals";
import type { PointInChartFactory } from "../chartAffineSpace.js";
import type { ChartValue, DataUnit } from "../../types.js";
import type {
  ComputedTraceStyle,
  TraceList,
  TraceStatistics,
} from "../../data-worker/trace-list.js";
import { toNumeric } from "../../utils/unit.js";

export type ChartMouseEvent =
  | {
      name: "move";
      event: MouseEvent;
    }
  | {
      name: "out";
    };

export interface CloseTrace {
  traceId: string;
  style: ComputedTraceStyle;
  x: ChartValue;
  y: ChartValue;
}

export interface HoveredTrace extends CloseTrace {
  statistics: TraceStatistics;
}

export interface MouseHoverProps {
  visibleTraces$: Signal<TraceList>;
  hoverEvent$: Signal<ChartMouseEvent | undefined>;
  point(): PointInChartFactory;

  tooltipTraceCount$: Signal<number | "all">;
  traceHoverPointRadius$: Signal<number>;

  yDataUnit$: Signal<DataUnit>;

  commonXRuler$: WritableSignal<ChartValue | undefined>;
  commonYRuler$: WritableSignal<ChartValue | undefined>;

  defer: DeferLike;
}

export interface MouseHover {
  nearestTraces$: Signal<CloseTrace[]>;
  hoveredTrace$: Signal<HoveredTrace | undefined>;
}

export const hover$ = ({
  visibleTraces$,
  hoverEvent$,
  point,
  traceHoverPointRadius$,
  tooltipTraceCount$,
  yDataUnit$,
  commonXRuler$,
  commonYRuler$,
  defer: deferLike,
}: MouseHoverProps): MouseHover => {
  const defer = Defer.from(deferLike);

  const hoverQuantity$ = hoverEvent$.map((e, { prev }) => {
    e ??= prev;
    if (!e) return { x: undefined, y: undefined };

    switch (e.name) {
      case "move":
        return point()
          .fromLogicalPixels(e.event.offsetX, e.event.offsetY)
          .toQuantitites();

      case "out":
        return { x: undefined, y: undefined };
    }
  });

  hoverQuantity$
    .subscribe(({ x, y }) => {
      commonXRuler$.set(x);
      commonYRuler$.set(y);
    })
    .pipe(defer);

  const unstyledNearestTraces$ = derived(($) => {
    const { x, y } = $(hoverQuantity$);
    if (x === undefined || y === undefined) return [];

    const traces = $(visibleTraces$);
    const _count = $(tooltipTraceCount$);
    const count = _count === "all" ? traces.traceCount : _count;

    return traces.findNearestTraces({ x, y }, count);
  });

  const nearestTracesSortedByCloseness$ = derived(($): CloseTrace[] => {
    const traces = $(visibleTraces$);
    return $(unstyledNearestTraces$).map(({ traceId, x, y }) => ({
      style: traces.getStyle(traceId),
      traceId,
      x,
      y,
    }));
  });

  const isClosestTraceHovered$ = derived(($) => {
    const trace = $(nearestTracesSortedByCloseness$)?.[0];
    if (!trace) return false;

    const { x, y } = $(hoverQuantity$);
    if (x === undefined || y === undefined) return false;

    const hoverPoint = point().fromQuantities(x, y);
    const closestPoint = point().fromQuantities(trace.x, trace.y);

    const dist = hoverPoint.vectorTo(closestPoint).magnitudeInLogicalPixels();

    return dist <= $(traceHoverPointRadius$);
  });

  const hoveredTrace$ = derived(($) => {
    const trace = $(nearestTracesSortedByCloseness$).at(0);
    if (!$(isClosestTraceHovered$) || !trace) return;

    const statistics = $(visibleTraces$).calculateStatistics({
      traces: [trace.traceId],
    })[0];

    return {
      ...trace,
      statistics,
    };
  });

  const nearestTraces$ = nearestTracesSortedByCloseness$.map((traces) => {
    const yDataUnit = yDataUnit$.get();
    const yToNum = (y: ChartValue) => toNumeric(y, yDataUnit);
    return traces.toSorted((a, b) => yToNum(b.y) - yToNum(a.y));
  });

  return { nearestTraces$, hoveredTrace$ };
};