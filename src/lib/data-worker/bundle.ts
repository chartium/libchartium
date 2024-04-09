import type {
  ChartValue,
  DataUnit,
  NumericRange,
  Range,
  TraceHandle,
  TraceHandleArray,
} from "../types.js";
import { filter } from "../utils/collection.js";
import {
  toChartValue,
  toNumeric,
  toNumericRange,
  toRange,
} from "../utils/unit.js";
import type { lib } from "./wasm.js";

export class Bundle {
  constructor(
    public boxed: lib.BoxedBundle,
    public xDataUnit: DataUnit,
    public yDataUnit: DataUnit,
  ) {}

  get traces(): TraceHandleArray {
    return this.boxed.traces();
  }

  rangeInView(view: Range): Range & { inBundleUnits(): NumericRange } {
    const viewNumeric = toNumericRange(view, this.xDataUnit);
    const reducedNumeric = this.boxed.range_in_view(viewNumeric);
    const reduced = toRange(reducedNumeric, this.xDataUnit);
    return {
      ...reduced,
      inBundleUnits() {
        return reducedNumeric;
      },
    };
  }

  tracesOverThreshold(
    handles: TraceHandleArray,
    range: Range,
    threshold: ChartValue,
  ): Iterable<TraceHandle> {
    const thresholdNum = toNumeric(threshold, this.yDataUnit);
    const include: boolean[] = this.boxed.are_traces_over_threshold(
      handles,
      this.rangeInView(range).inBundleUnits(),
      thresholdNum,
    );

    let i = 0;
    return filter(handles, () => include[i++]);
  }

  tracesOverThreshold_alt(
    handles: TraceHandleArray,
    range: Range,
    threshold: ChartValue,
  ): Iterable<TraceHandle> {
    const thresholdNum = toNumeric(threshold, this.yDataUnit);
    const rangeNum = this.rangeInView(range).inBundleUnits();

    return filter(handles, (h) =>
      this.boxed.is_trace_over_treshold(h, rangeNum, thresholdNum),
    );
  }

  findClosestTraces(
    handles: TraceHandleArray,
    point: { x: ChartValue; y: ChartValue },
    howMany: number,
  ): Array<{
    handle: TraceHandle;
    x: ChartValue;
    y: ChartValue;
  }> {
    return this.boxed
      .find_n_closest_points(
        handles,
        toNumeric(point.x, this.xDataUnit),
        toNumeric(point.y, this.yDataUnit),
        howMany,
      )
      .map(({ handle, x, y }: lib.TracePoint) => ({
        handle,
        x: toChartValue(x, this.xDataUnit),
        y: toChartValue(y, this.yDataUnit),
      }));
  }
}
