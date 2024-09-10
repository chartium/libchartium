import {
  Defer,
  derived,
  type DeferLike,
  type Signal,
  type WritableSignal,
} from "@typek/signalhead";
import type { PointInChartFactory } from "../core/chartAffineSpace.js";
import type { ChartValue, DataUnit } from "../../types.js";
import type {
  ComputedTraceStyle,
  TraceList,
  TraceStatistics,
} from "../../data/trace-list.js";
import { toNumeric } from "../../units/mod.js";
import type { InterpolationStrategy } from "../../../../dist/wasm/libchartium.js";

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
  displayY: ChartValue;
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

  interpolation: InterpolationStrategy;
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
  interpolation,
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

  const unstyledNearestTraces$ = derived((S) => {
    const { x, y } = S(hoverQuantity$);
    if (x === undefined || y === undefined) return [];

    const traces = S(visibleTraces$);
    const _count = S(tooltipTraceCount$);
    const count = _count === "all" ? traces.traceCount : _count;

    return traces.findNearestTraces({ x, y }, count, interpolation);
  });

  const nearestTracesSortedByCloseness$ = derived((S): CloseTrace[] => {
    const traces = S(visibleTraces$);
    return S(unstyledNearestTraces$).map(({ traceId, x, y, displayY }) => ({
      style: traces.getStyle(traceId),
      traceId,
      x,
      y,
      displayY,
    }));
  });

  const isClosestTraceHovered$ = derived((S) => {
    const trace = S(nearestTracesSortedByCloseness$)?.[0];
    if (!trace) return false;

    const { x, y } = S(hoverQuantity$);
    if (x === undefined || y === undefined) return false;

    const hoverPoint = point().fromQuantities(x, y);
    const closestPoint = point().fromQuantities(trace.x, trace.displayY);

    const dist = hoverPoint.vectorTo(closestPoint).magnitudeInLogicalPixels();

    return dist <= S(traceHoverPointRadius$);
  });

  const hoveredTrace$ = derived((S) => {
    const trace = S(nearestTracesSortedByCloseness$).at(0);
    if (!S(isClosestTraceHovered$) || !trace) return;

    const statistics = S(visibleTraces$).calculateStatistics({
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
    return traces.toSorted((a, b) => yToNum(b.displayY) - yToNum(a.displayY));
  });

  return { nearestTraces$, hoveredTrace$ };
};
