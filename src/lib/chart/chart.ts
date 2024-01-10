import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker/index.js";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod.js";
import type {
  GeneralizedPoint,
  NumericRange,
  Range,
  Shift,
  Threshold,
  Tick,
  Unit,
  Zoom,
} from "../types.js";
import { Quantity } from "../types.js";
import { TraceList } from "../data-worker/trace-list.js";
import { linearTicks } from "../utils/ticks.js";
import { nextAnimationFrame } from "../utils/promise.js";
import type { FactorDefinition } from "unitlib";

import { mut } from "@mod.js/signals";
import type {
  Signal,
  Subscriber,
  SignalValue,
  WritableSignal,
} from "@mod.js/signals";
export type { Signal, WritableSignal };
import {
  toNumeric,
  toNumericRange,
  toQuantOrDay,
  toRange,
} from "../utils/quantityHelpers.js";
import dayjs from "dayjs";
import { NumericDateFormat } from "../index.js";
import { norm } from "./position.js";
import {
  addMarginsToRange,
  addZeroToRange,
  type RangeMargins,
} from "../utils/rangeMargins.js";

const toDisplayUnit = (unit: Unit | NumericDateFormat | undefined) =>
  unit instanceof NumericDateFormat ? undefined : unit;

/**
 * A helper method that takes a signal, adds a
 * subscriber to it, and returns that signal.
 *
 * **FOOTGUN WARNING**: There is no way to
 * unsubscribe that subscriber. Beware memory
 * leaks.
 */
const withSubscriber = <S extends Signal<any>>(
  signal: S,
  sub: Subscriber<SignalValue<S>>
) => {
  signal.subscribe(sub);
  return signal;
};

/**
 * A helper method, similar to withSubscriber,
 * which takes a signal, adds a subscriber to it,
 * and returns that signal. However, the callback
 * will not be called immediately, only with
 * subsequent changes.
 *
 * **FOOTGUN WARNING**: There is no way to
 * unsubscribe that subscriber. Beware memory
 * leaks.
 */
const withListener = <S extends Signal<any>>(
  signal: S,
  sub: Subscriber<SignalValue<S>>
) => {
  let firstCall = true;
  return withSubscriber(signal, (value, params) => {
    if (firstCall) firstCall = false;
    else sub(value, params);
  });
};

/**
 * Chartium render handler that is to be used by frontend svelte comonents to render charts.
 * It automatically re-renders when anything about the chart changes.
 */
export class Chart {
  #renderer?: Renderer;
  get renderer() {
    return this.#renderer;
  }

  #xDataUnit: Unit | NumericDateFormat | undefined;
  #yDataUnit: Unit | NumericDateFormat | undefined;

  readonly defaultXDisplayUnit = mut<Unit | undefined | "auto" | "data">(
    "auto"
  );
  readonly defaultYDisplayUnit = mut<Unit | undefined | "auto" | "data">(
    "auto"
  );
  readonly currentXDisplayUnit = mut<Unit | undefined>();
  readonly currentYDisplayUnit = mut<Unit | undefined>();

  /**
   * The list of traces to be rendered in this chart.
   */
  readonly traces: WritableSignal<TraceList>;

  /**
   * The visible range (in display units) of the x axis, changes with user
   * interaction (eg. zooming and panning). To reset both axes to fit the data,
   * use the `resetZoom` method.
   */
  readonly xRange: WritableSignal<Range>;

  /**
   * The visible range (in display units) of the y axis, changes with user
   * interaction (eg. zooming and panning). To reset both axes to fit the data,
   * use the `resetZoom` method.
   */
  readonly yRange: WritableSignal<Range>;

  /**
   * The dimensions of this chart in pixels.
   */
  readonly size: WritableSignal<{ width: number; height: number }>;

  /**
   * Margins to be added around the provided trace data on autozoom.
   */
  readonly margins: WritableSignal<RangeMargins | undefined>;

  /**
   * Whether autozoom should increase the range such that x=0 is visible.
   */
  readonly showXAxisZero: WritableSignal<boolean>;

  /**
   * Whether autozoom should increase the range such that y=0 is visible.
   */
  readonly showYAxisZero: WritableSignal<boolean>;

  #autozoomed = true;
  #defaultUnits = true;

  xTextSize?: (text: string) => number;
  yTextSize?: (text: string) => number;

  constructor(
    public readonly controller: ChartiumController | Remote<ChartiumController>,
    public readonly canvas: OffscreenCanvas,
    traces?: TraceList
  ) {
    // signals
    traces ??= TraceList.empty();

    this.traces = withSubscriber(mut(traces), (t) => this.#updateTraces(t));

    this.xRange = withListener(mut(traces.range), () => {
      this.scheduleRender();
      this.#autozoomed = false;
    });
    this.yRange = withListener(mut(traces.getYRange()), () => {
      this.scheduleRender();
      this.#autozoomed = false;
    });

    this.size = withListener(
      mut({ width: NaN, height: NaN }),
      ({ width, height }) => {
        this.#renderer?.setSize(width, height);
        this.scheduleRender();
      }
    );

    this.resetUnits();
    withListener(this.currentXDisplayUnit, () => this.#updateTicks());
    withListener(this.currentYDisplayUnit, () => this.#updateTicks());

    this.margins = withListener(mut(), this.scheduleRender);
    this.showXAxisZero = withListener(mut(false), this.scheduleRender);
    this.showYAxisZero = withListener(mut(false), this.scheduleRender);

    // canvas & renderer
    this.controller.createRenderer(transfer(canvas, [canvas])).then((r) => {
      this.#renderer = r;
      this.scheduleRender();
    });

    this.raiseXFactorAction = changeFactorAction(
      "raise",
      this.currentXDisplayUnit
    );
    this.lowerXFactorAction = changeFactorAction(
      "lower",
      this.currentXDisplayUnit
    );
    this.raiseYFactorAction = changeFactorAction(
      "raise",
      this.currentYDisplayUnit
    );
    this.lowerYFactorAction = changeFactorAction(
      "lower",
      this.currentYDisplayUnit
    );
    this.resetXFactorAction = resetFactorAction({
      currentUnit: this.currentXDisplayUnit,
      defaultUnitSettings: this.defaultXDisplayUnit,
      dataUnit: traces.getUnits()[0].x,
      autoUnit: () => this.bestDisplayUnits("x"),
    });
    this.resetYFactorAction = resetFactorAction({
      currentUnit: this.currentYDisplayUnit,
      defaultUnitSettings: this.defaultYDisplayUnit,
      dataUnit: traces.getUnits()[0].y,
      autoUnit: () => this.bestDisplayUnits("y"),
    });

    this.resetZoom();
  }

  #updateTraces(traces: TraceList) {
    const dataUnits = traces.getUnits()[0] ?? {};
    this.#xDataUnit = dataUnits.x;
    this.#yDataUnit = dataUnits.y;

    // TODO reset units if incompatible
    // this.xDisplayUnit.set(toDisplayUnit(dataUnits.x));
    // this.yDisplayUnit.set(toDisplayUnit(dataUnits.y));
    this.scheduleRender();
  }

  /**
   * Render the chart. This gets called automatically if you use any of the setters.
   * Automatically calculates the ranges and estimates type if undefined.
   */
  render() {
    console.log("chartium: rendered");

    if (this.#renderer === undefined) {
      // renderer gets initialized when canvas is assigned
      throw new Error("Canvas not assigned");
    }

    if (this.#autozoomed === true) this.resetZoom();

    let firstRun = true;
    for (const [units, traces] of this.traces.get().getUnitsToTraceMap()) {
      const clear = firstRun;
      firstRun = false;

      const renderJob: RenderJob = {
        traces,

        // TODO read xType
        xType: "f32",
        xRange: toNumericRange(this.xRange.get(), units.x),
        yRange: toNumericRange(this.yRange.get(), units.y),
        clear,
      };

      this.#renderer.render(renderJob);
    }

    this.#updateTicks();
  }

  tryRender(): boolean {
    if (this.#renderer) {
      this.render();
      return true;
    }
    return false;
  }

  #renderScheduled = false;
  scheduleRender = async () => {
    // render already scheduled
    if (this.#renderScheduled) return;

    try {
      this.#renderScheduled = true;
      await nextAnimationFrame();
      this.tryRender();
    } finally {
      this.#renderScheduled = false;
    }
  };

  readonly #xTicks = mut<Tick[]>([]);
  readonly #yTicks = mut<Tick[]>([]);
  readonly xTicks = this.#xTicks.toReadonly();
  readonly yTicks = this.#yTicks.toReadonly();

  #updateTicks() {
    const xRange = this.xRange.get();
    if (xRange && this.xTextSize) {
      const displayUnit = this.currentXDisplayUnit.get();
      this.#xTicks.set(
        linearTicks({
          range: xRange,
          displayUnit,
          axisSize: this.canvas.width,
          textMeasuringFunction: this.xTextSize,
        })
      );
    }

    const yRange = this.yRange.get();
    if (yRange && this.yTextSize) {
      const displayUnit = this.currentYDisplayUnit.get();
      this.#yTicks.set(
        linearTicks({
          range: yRange,
          displayUnit,
          axisSize: this.canvas.height,
          textMeasuringFunction: this.yTextSize,
        })
      );
    }
  }

  /**
   * @param axis which axis to reset, defaults to both
   * @param showYZero if true the y range will be stretched to include 0 if necessary
   */
  resetZoom(axis: "x" | "y" | "both" = "both") {
    const traces = this.traces.get();
    let xRange = traces.range;
    let yRange = traces.getYRange();

    const margins = this.margins.get() ?? { vertical: { percent: 5 } };
    const size = this.size.get();
    ({ xRange, yRange } = addMarginsToRange(margins, size, xRange, yRange));

    if (this.showXAxisZero.get())
      xRange = addZeroToRange(xRange, this.#xDataUnit);
    if (this.showYAxisZero.get())
      yRange = addZeroToRange(yRange, this.#yDataUnit);

    if (axis === "x" || axis === "both") this.xRange.set(xRange);
    if (axis === "y" || axis === "both") this.yRange.set(yRange);

    this.#autozoomed = true;
    return this.scheduleRender();
  }

  resetUnits(axes: "x" | "y" | "both" = "both") {
    this.currentXDisplayUnit.set(
      findResetUnit({
        dataUnit: this.traces.get().getUnits()[0].x,
        defaultUnitSettings: this.defaultXDisplayUnit.get(),
        autoUnit: () => this.bestDisplayUnits("x"),
      })
    );
    this.currentYDisplayUnit.set(
      findResetUnit({
        dataUnit: this.traces.get().getUnits()[0].y,
        defaultUnitSettings: this.defaultYDisplayUnit.get(),
        autoUnit: () => this.bestDisplayUnits("y"),
      })
    );
  }

  // FIXME
  bestDisplayUnits(axis: "x" | "y"): Unit | undefined {
    const unit = this.traces.get().getUnits()[0][axis];
    if (unit instanceof NumericDateFormat) return undefined;
    return unit;

    // // FIXME recognize when to use date
    // const units = this.traces.get().getUnits();
    // const xUnits = units.map((u) => u.x);
    // const yUnits = units.map((u) => u.y);
    // let medianXUnit;
    // if (xUnits[0] === "date" || xUnits[0] === undefined) {
    //   medianXUnit = xUnits[0];
    // } else {
    //   medianXUnit = xUnits.sort(
    //     (a, b) =>
    //       (a as Unit).multiplyValueByFactor(1) - //FIXME this cant be the right way
    //       (b as Unit).multiplyValueByFactor(1) //FIXME this cant be the right way
    //   )[Math.floor(xUnits.length / 2)];
    // }

    // let medianYUnit;
    // if (yUnits[0] === "date" || yUnits[0] === undefined) {
    //   medianYUnit = yUnits[0];
    // } else {
    //   medianYUnit = yUnits.sort(
    //     (a, b) =>
    //       (a as Unit).multiplyValueByFactor(1) - //FIXME this cant be the right way
    //       (b as Unit).multiplyValueByFactor(1) //FIXME this cant be the right way
    //   )[Math.floor(yUnits.length / 2)];
    // }

    // return {
    //   x: medianXUnit,
    //   y: medianYUnit,
    // };
  }

  /** Transforms x, y fraction of canvas size into chart quantity (or unitless number) */
  fractionsToQuantities(
    fraction: number,
    axis: "x" | "y"
  ): Quantity | dayjs.Dayjs | number {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    const unit = this.bestDisplayUnits(axis);

    const value =
      toNumeric(range.from, unit) +
      (axis === "x" ? fraction : 1 - fraction) *
        (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    return toQuantOrDay(value, unit);
  }

  /** Transforms x, y of chart quantity (or unitless number) into fraction of canvas size */
  quantitiesToFractions(
    quantity: Quantity | dayjs.Dayjs | number,
    axis: "x" | "y"
  ): number {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    if (!range) throw new Error(`${axis} range is undefined`);
    const unit = axis === "x" ? this.#xDataUnit : this.#yDataUnit;

    const fraction =
      (toNumeric(quantity, unit) - toNumeric(range.from, unit)) /
      (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    return fraction;
  }

  /** Transforms x, y pixel coordinates (relative to chart canvas) of a point into the x, y quantities or numbers */
  coordinatesToQuantities(
    coordinateInPx: number,
    axis: "x" | "y"
  ): Quantity | number | dayjs.Dayjs {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    const unit = axis === "x" ? this.#xDataUnit : this.#yDataUnit;

    if (!range) throw new Error("xRange or yRange is undefined");

    const value =
      toNumeric(range.from, unit) +
      (axis === "x"
        ? coordinateInPx / this.canvas!.width
        : 1 - coordinateInPx / this.canvas!.height) *
        (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    return toQuantOrDay(value, unit);
  }

  /** Transforms a point represented by data values and units (if aplicable) into pixel coordinates relative to chart canvas */
  quantityToCoordinate(
    quantity: Quantity | dayjs.Dayjs | number,
    axis: "x" | "y"
  ): number {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();

    if (
      typeof range.from !== typeof quantity &&
      typeof range.to !== typeof quantity
    ) {
      throw new Error(
        "Either range is numeric and you passed a quantity, or vice versa"
      );
    }

    const displayUnit =
      axis === "x"
        ? this.currentXDisplayUnit.get()
        : this.currentYDisplayUnit.get();

    if (range === undefined) throw new Error(`${axis} range is undefined`);

    const minusFromOverRange = (q: Quantity | dayjs.Dayjs | number) =>
      (toNumeric(q, displayUnit) - toNumeric(range.from, displayUnit)) /
      (toNumeric(range.to, displayUnit) - toNumeric(range.from, displayUnit));

    const coordinate =
      axis === "x"
        ? minusFromOverRange(quantity) * this.canvas!.width
        : (1 - minusFromOverRange(quantity)) * this.canvas!.height;
    return coordinate;
  }

  zoomRange({ detail }: { detail: Zoom }) {
    for (const [axis, zoom] of Object.entries(detail) as [
      string,
      NumericRange
    ][]) {
      const rangeName = `${axis}Range` as "xRange" | "yRange";
      const range = this[rangeName].get();
      const unit = rangeName === "xRange" ? this.#xDataUnit : this.#yDataUnit;

      const d = toNumeric(range.to, unit) - toNumeric(range.from, unit);

      if (zoom.to - zoom.from <= 0) continue;

      this[rangeName].set(
        toRange(
          {
            from: toNumeric(range.from, unit) + d * zoom.from,
            to: toNumeric(range.from, unit) + d * zoom.to,
          },
          unit
        )
      );
    }
  }

  shiftRange({ detail: shift }: { detail: Shift }) {
    {
      const xRange = this.xRange.get();
      const xUnits = this.#xDataUnit;
      const from = toNumeric(xRange.from, xUnits);
      const to = toNumeric(xRange.to, xUnits);
      if (shift.dx) {
        const delta = (to - from) * -shift.dx;
        this.xRange.set(
          toRange(
            {
              from: from + delta,
              to: to + delta,
            },
            xUnits
          )
        );
      }
    }
    {
      const yRange = this.yRange.get();
      const yUnits = this.#yDataUnit;
      const from = toNumeric(yRange.from, yUnits);
      const to = toNumeric(yRange.to, yUnits);
      if (shift.dy) {
        const delta = (to - from) * -shift.dy;
        this.yRange.set(
          toRange({ from: from + delta, to: to + delta }, yUnits)
        );
      }
    }
  }

  /**
   * Returns IDs of traces below the threshold so they can be hidden
   * if your traces are sin(x) and x^2, then filterByTreshold(1.1) only leaves the x^2
   */
  idsUnderThreshold({
    detail: threshold,
  }: {
    detail: Threshold;
  }): Iterable<string> {
    const yRange = this.yRange.get();
    const yUnits = this.#yDataUnit;

    const from = toNumeric(yRange.from, yUnits);
    const to = toNumeric(yRange.to, yUnits);
    const qThreshold = toQuantOrDay(
      from + (to - from) * threshold.thresholdFrac,
      this.#yDataUnit
    ) as number | Quantity;
    const traces = this.traces.get();

    const tracesWithThreshold = new Set(
      traces.withOverTreshold(qThreshold).traces()
    );
    const result = new Set<string>();

    for (const trace of traces.traces()) {
      if (!tracesWithThreshold.has(trace)) {
        result.add(trace);
      }
    }

    return result;
  }

  distanceInDataUnits(a: GeneralizedPoint, b: GeneralizedPoint) {
    return norm([
      toNumeric(b.x, this.#xDataUnit) - toNumeric(a.x, this.#xDataUnit),
      toNumeric(b.y, this.#yDataUnit) - toNumeric(a.y, this.#yDataUnit),
    ]);
  }

  readonly raiseXFactorAction: ReturnType<typeof changeFactorAction>;
  readonly lowerXFactorAction: ReturnType<typeof changeFactorAction>;
  readonly resetXFactorAction: ReturnType<typeof changeFactorAction>;
  readonly raiseYFactorAction: ReturnType<typeof changeFactorAction>;
  readonly lowerYFactorAction: ReturnType<typeof changeFactorAction>;
  readonly resetYFactorAction: ReturnType<typeof changeFactorAction>;
}

/**
 * A signal that corresponds to the context menu options "Raise unit to..."
 * and "Lower unit to...", it contains the unit to be changed to, and a
 * callback that actually performs the change
 */
const changeFactorAction = (
  direction: "raise" | "lower",
  displayUnit: WritableSignal<Unit | NumericDateFormat | undefined>
) =>
  displayUnit.map((unit) => {
    // NOTE changing the factor of a date range is not supported
    if (!unit || unit instanceof NumericDateFormat) return;

    const factorsEqual = (a: FactorDefinition, b: FactorDefinition) =>
      a.mul === b.mul && a.base === b.base && a.exp === b.exp;

    const factors = Object.entries<FactorDefinition>(unit.unitSystem.factors);

    // add prefix-less factor
    factors.push(["(unitless)", { mul: 1, base: 1, exp: 1 }]);

    // if the current factor is non-standard, add it to the list
    if (!factors.find(([_, f]) => factorsEqual(unit.factor, f))) {
      factors.push(["(current)", unit.factor]);
    }

    // sort by value
    factors.sort(
      ([_, a], [__, b]) => a.mul * a.base ** a.exp - b.mul * b.base ** b.exp
    );

    const currentIndex = factors.findIndex(([_, f]) =>
      factorsEqual(unit.factor, f)
    );

    const newIndex = currentIndex + (direction === "raise" ? 1 : -1);
    if (newIndex < 0 || newIndex >= factors.length) return;

    const newFactor = factors[newIndex][1];
    const newUnit = unit.withFactor(newFactor);

    return {
      unit: newUnit,
      callback: () => displayUnit.set(newUnit),
    };
  });

const resetFactorAction = ({
  defaultUnitSettings,
  dataUnit,
  currentUnit,
  autoUnit,
}: {
  defaultUnitSettings: Signal<Unit | undefined | "auto" | "data">;
  dataUnit: Unit | NumericDateFormat | undefined;
  currentUnit: WritableSignal<Unit | undefined>;
  autoUnit: () => Unit | undefined;
}) =>
  defaultUnitSettings.zip(currentUnit).map(([def, curr]) => {
    const targetUnit = findResetUnit({
      autoUnit,
      dataUnit,
      defaultUnitSettings: def,
    });

    if (!targetUnit || !curr) return;
    if (targetUnit.isEqual(curr)) return;

    return {
      unit: targetUnit,
      callback: () => currentUnit.set(targetUnit),
    };
  });

const findResetUnit = ({
  defaultUnitSettings,
  dataUnit,
  autoUnit,
}: {
  defaultUnitSettings: Unit | undefined | "auto" | "data";
  dataUnit: Unit | NumericDateFormat | undefined;
  autoUnit: () => Unit | undefined;
}) => {
  switch (defaultUnitSettings) {
    case "data":
      if (dataUnit instanceof NumericDateFormat) return undefined;
      return dataUnit;

    case "auto":
      return autoUnit();

    default:
      return defaultUnitSettings;
  }
};
