import type { InterpolationStrategy } from "../../../dist/wasm/libchartium.js";
import type {
  ChartValue,
  DataUnit,
  NumericRange,
  ChartRange,
  VariantHandle,
  VariantHandleArray,
} from "../types.js";
import { filter } from "../utils/collection.js";
import {
  toChartValue,
  toNumeric,
  toNumericRange,
  toChartRange,
} from "../units/mod.js";
import type { lib } from "../wasm.js";

export class Bundle {
  constructor(
    public boxed: lib.BundleRc,
    public xDataUnit: DataUnit,
    public yDataUnit: DataUnit,
  ) {}

  get traces(): VariantHandleArray {
    return this.boxed.traces();
  }

  rangeInView(
    view: ChartRange,
  ): ChartRange & { inBundleUnits(): NumericRange } {
    const viewNumeric = toNumericRange(view, this.xDataUnit);
    const reducedNumeric = this.boxed.range_in_view(viewNumeric);
    const reduced = toChartRange(reducedNumeric, this.xDataUnit);
    return {
      ...reduced,
      inBundleUnits() {
        return reducedNumeric;
      },
    };
  }

  tracesOverThreshold(
    handles: VariantHandleArray,
    range: ChartRange,
    threshold: ChartValue,
  ): Iterable<VariantHandle> {
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
    handles: VariantHandleArray,
    range: ChartRange,
    threshold: ChartValue,
  ): Iterable<VariantHandle> {
    const thresholdNum = toNumeric(threshold, this.yDataUnit);
    const rangeNum = this.rangeInView(range).inBundleUnits();

    return filter(handles, (h) =>
      this.boxed.is_trace_over_threshold(h, rangeNum, thresholdNum),
    );
  }

  findClosestTraces(
    handles: VariantHandleArray,
    point: { x: ChartValue; y: ChartValue },
    howMany: number,
    interpolation: InterpolationStrategy,
  ): Array<{
    handle: VariantHandle;
    x: ChartValue;
    y: ChartValue;
    displayY: ChartValue;
    dist: ChartValue;
  }> {
    return this.boxed
      .find_n_closest_points(
        handles,
        toNumeric(point.x, this.xDataUnit),
        toNumeric(point.y, this.yDataUnit),
        howMany,
        undefined,
        interpolation,
      )
      .map(({ handle, x, y, displayY, dist }: lib.TracePoint) => ({
        handle,
        x: toChartValue(x, this.xDataUnit),
        y: toChartValue(y, this.yDataUnit),
        displayY: toChartValue(displayY, this.yDataUnit),
        dist: toChartValue(dist, this.yDataUnit),
      }));
  }
}
