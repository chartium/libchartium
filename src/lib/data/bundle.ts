import { filter } from "@typek/typek";
import type { InterpolationStrategy } from "../../../dist/wasm/libchartium.js";
import type {
  ChartValue,
  DataUnit,
  NumericRange,
  ChartRange,
  VariantHandle,
  VariantHandleArray,
} from "../types.js";
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

  /**
   * Iterate over the data of this bundle, yielded as rows in the format [x, y0, y1, ...].
   * The rows are views into the underlying buffer (ie. sub-arrays) to avoid needlessly copying
   * data. However, if you need to keep a reference to previous items, or collect them into
   * an array, you have to copy them first.
   */
  *rawData({
    handles,
    range,
    bufferSize,
  }: {
    handles?: VariantHandleArray;
    range: ChartRange;
    bufferSize?: number;
  }): Iterable<Float64Array> {
    handles ??= this.traces;
    const itemLength = handles.length + 1;

    bufferSize ??= 1000 * itemLength;
    const buffer = new Float64Array(bufferSize);

    const numericRange = toNumericRange(range, this.xDataUnit);
    let { from } = numericRange;
    const { to } = numericRange;

    // The Rust-side API is implemented in such a way, that if we want
    // to create a new export that starts where the last one ended, we
    // have to request the last exported datapoint again.
    // In order to avoid duplicates, we skip the first exported datapoint
    // on all exports except the very first one.

    let firstRun = true;
    while (true) {
      const bufferSize = this.boxed.export_to_buffer(buffer, handles, {
        from,
        to,
      });

      const itemCount = bufferSize / itemLength;
      if (itemCount === 0) return;
      if (!firstRun && itemCount < 2) return;

      for (let i = firstRun ? 0 : itemLength; i < itemCount; i++) {
        yield buffer.subarray(i * itemLength, (i + 1) * itemLength);
      }

      // last exported x
      from = buffer[(itemCount - 1) * itemLength];

      firstRun = false;
    }
  }
}
