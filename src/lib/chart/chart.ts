import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker/index.js";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod.js";
import type {
  ChartValuePoint,
  NumericRange,
  Range,
  Shift,
  Threshold,
  Tick,
  Unit,
  Zoom,
} from "../types.js";
import { Quantity, rangesHaveMeaningfulIntersection } from "../types.js";
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
import { norm } from "../components/position.js";
import {
  addMarginsToRange,
  addZeroToRange,
  type RangeMargins,
} from "../utils/rangeMargins.js";
import Fraction from "fraction.js";

export interface UnitChangeAction {
  unit: Unit;
  callback(): void;
}

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
  sub: Subscriber<SignalValue<S>>,
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
  sub: Subscriber<SignalValue<S>>,
) => {
  let firstCall = true;
  return withSubscriber(signal, (value, params) => {
    if (firstCall) firstCall = false;
    else sub(value, params);
  });
};

const isDisplayUnitValidForDataUnit = (
  dataUnit: Unit | NumericDateFormat | undefined,
  displayUnit: Unit | undefined,
) => {
  if (!dataUnit || dataUnit instanceof NumericDateFormat)
    return displayUnit === undefined;
  try {
    new Quantity(1, dataUnit).inUnits(displayUnit!);
    return true;
  } catch {
    return false;
  }
};

/**
 * Chartium render handler that is to be used by frontend svelte components to render charts.
 * It automatically re-renders when anything about the chart changes.
 */
export class Chart {
  #renderer?: Renderer;
  get renderer() {
    return this.#renderer;
  }

  #dataUnit: {
    x?: Unit | NumericDateFormat | undefined;
    y?: Unit | NumericDateFormat | undefined;
  } = {};

  readonly defaultDisplayUnit = {
    x: mut<Unit | undefined | "auto" | "data">("auto"),
    y: mut<Unit | undefined | "auto" | "data">("auto"),
  };
  readonly currentDisplayUnit = {
    x: mut<Unit | undefined>(),
    y: mut<Unit | undefined>(),
  };

  /**
   * The list of traces to be rendered in this chart.
   */
  readonly traces: WritableSignal<TraceList>;

  /**
   * The visible range (in display units) of the x & y axes, changes with user
   * interaction (eg. zooming and panning). To reset one or both axes to fit
   * the data, use the `resetZoom` method.
   */
  readonly range: {
    x: WritableSignal<Range>;
    y: WritableSignal<Range>;
  };

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
  #currentUnitsAreDefault = { x: true, y: true };

  textSize: { x?: (text: string) => number; y?: (text: string) => number } = {};

  #initialized = false;

  constructor(
    public readonly controller: ChartiumController | Remote<ChartiumController>,
    public readonly canvas: OffscreenCanvas,
    traces?: TraceList,
  ) {
    if (controller.initialized !== true) {
      throw new Error(
        "Tried to initialize Chart while ChartiumController is still unitialized.",
      );
    }

    // signals
    traces ??= TraceList.empty();

    this.traces = withSubscriber(mut(traces), (t) => this.#updateTraces(t));

    this.range = {
      x: withListener(mut(traces.range), () => {
        this.scheduleRender();
        this.#autozoomed = false;
      }),
      y: withListener(mut(traces.getYRange()), () => {
        this.scheduleRender();
        this.#autozoomed = false;
      }),
    };

    this.size = withListener(
      mut({ width: NaN, height: NaN }),
      ({ width, height }) => {
        this.#renderer?.setSize(width, height);
        this.scheduleRender();
      },
    );

    this.resetUnits();
    withListener(this.currentDisplayUnit.x, () => this.#updateTicks("x"));
    withListener(this.currentDisplayUnit.y, () => this.#updateTicks("y"));
    withListener(this.defaultDisplayUnit.x, () => {
      if (this.#currentUnitsAreDefault.x) this.resetUnits("x");
    });
    withListener(this.defaultDisplayUnit.y, () => {
      if (this.#currentUnitsAreDefault.y) this.resetUnits("y");
    });

    this.margins = withListener(mut(), this.scheduleRender);
    this.showXAxisZero = withListener(mut(false), this.scheduleRender);
    this.showYAxisZero = withListener(mut(false), this.scheduleRender);

    // canvas & renderer
    this.controller.createRenderer(transfer(canvas, [canvas])).then((r) => {
      this.#renderer = r;
      this.scheduleRender();
    });

    this.raiseXFactorAction = this.#changeFactorAction("raise", "x");
    this.lowerXFactorAction = this.#changeFactorAction("lower", "x");
    this.raiseYFactorAction = this.#changeFactorAction("raise", "y");
    this.lowerYFactorAction = this.#changeFactorAction("lower", "y");
    this.resetXFactorAction = this.#resetFactorAction("x");
    this.resetYFactorAction = this.#resetFactorAction("y");

    this.resetZoom();

    this.#initialized = true;
  }

  #updateTraces(traces: TraceList) {
    this.#dataUnit = traces.getUnits()?.[0] ?? {};
    this.scheduleRender();

    if (!this.#initialized) return;

    // reset units if incompatible
    for (const axis of <const>["x", "y"]) {
      if (
        !isDisplayUnitValidForDataUnit(
          this.#dataUnit[axis],
          this.currentDisplayUnit[axis].get(),
        )
      ) {
        this.resetUnits(axis);
      }
    }

    // reset zoom if not intersecting
    if (
      !rangesHaveMeaningfulIntersection(this.range.x.get(), traces.range) ||
      !rangesHaveMeaningfulIntersection(this.range.y.get(), traces.getYRange())
    ) {
      this.resetZoom();
    }
  }

  /**
   * Render the chart. This gets called automatically if you use any of the setters.
   * Automatically calculates the ranges and estimates type if undefined.
   */
  render() {
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
        xRange: toNumericRange(this.range.x.get(), units.x),
        yRange: toNumericRange(this.range.y.get(), units.y),
        clear,
      };

      this.#renderer.render(renderJob);
    }

    this.#updateTicks("xy");
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

  readonly #ticks = {
    x: mut<Tick[]>([]),
    y: mut<Tick[]>([]),
  };
  readonly ticks = {
    x: this.#ticks.x.toReadonly(),
    y: this.#ticks.y.toReadonly(),
  };

  #updateTicks(axes: "x" | "y" | "xy") {
    for (const axis of axes as Iterable<"x" | "y">) {
      const range = this.range[axis].get();
      const textMeasuringFunction = this.textSize[axis];
      if (range && textMeasuringFunction) {
        const displayUnit = this.currentDisplayUnit[axis].get();
        this.#ticks[axis].set(
          linearTicks({
            range: range,
            displayUnit,
            axisSize: this.canvas.width,
            textMeasuringFunction,
          }),
        );
      }
    }
  }

  /**
   * @param axes which axis to reset, defaults to both
   * @param showYZero if true the y range will be stretched to include 0 if necessary
   */
  resetZoom(axes: "x" | "y" | "xy" = "xy") {
    const traces = this.traces.get();
    let xRange = traces.range;
    let yRange = traces.getYRange();

    const margins = this.margins.get() ?? { vertical: { percent: 5 } };
    const size = this.size.get();
    ({ xRange, yRange } = addMarginsToRange(margins, size, xRange, yRange));

    if (this.showXAxisZero.get())
      xRange = addZeroToRange(xRange, this.#dataUnit.x);
    if (this.showYAxisZero.get())
      yRange = addZeroToRange(yRange, this.#dataUnit.y);

    if (axes.includes("x")) this.range.x.set(xRange);
    if (axes.includes("y")) this.range.y.set(yRange);

    this.#autozoomed = true;
    return this.scheduleRender();
  }

  resetUnits(axes: "x" | "y" | "xy" = "xy") {
    for (const axis of axes as Iterable<"x" | "y">) {
      this.currentDisplayUnit[axis].set(this.#findResetUnit(axis));
      this.#currentUnitsAreDefault[axis] = true;
    }
  }

  // FIXME
  bestDisplayUnits(axis: "x" | "y"): Unit | undefined {
    const unit = this.#dataUnit[axis];
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
    axis: "x" | "y",
  ): Quantity | dayjs.Dayjs | number {
    const range = this.range[axis].get();
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
    axis: "x" | "y",
  ): number {
    const range = this.range[axis].get();
    if (!range) throw new Error(`${axis} range is undefined`);
    const unit = this.#dataUnit[axis];

    const fraction =
      (toNumeric(quantity, unit) - toNumeric(range.from, unit)) /
      (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    return fraction;
  }

  /** Transforms x, y pixel coordinates (relative to chart canvas) of a point into the x, y quantities or numbers */
  coordinatesToQuantities(
    coordinateInPx: number,
    axis: "x" | "y",
  ): Quantity | number | dayjs.Dayjs {
    const range = this.range[axis].get();
    const unit = this.#dataUnit[axis];
    const displayUnit = this.currentDisplayUnit[axis].get();

    if (!range) throw new Error("xRange or yRange is undefined");

    const value =
      toNumeric(range.from, unit) +
      (axis === "x"
        ? coordinateInPx / this.canvas!.width
        : 1 - coordinateInPx / this.canvas!.height) *
        (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    return toQuantOrDay(value, unit, displayUnit);
  }

  /** Transforms a point represented by data values and units (if applicable) into pixel coordinates relative to chart canvas */
  quantityToCoordinate(
    quantity: Quantity | dayjs.Dayjs | number,
    axis: "x" | "y",
  ): number {
    const range = this.range[axis].get();

    if (
      typeof range.from !== typeof quantity &&
      typeof range.to !== typeof quantity
    ) {
      throw new Error(
        "Either range is numeric and you passed a quantity, or vice versa",
      );
    }

    const displayUnit = dayjs.isDayjs(quantity)
      ? NumericDateFormat.EpochMilliseconds
      : this.currentDisplayUnit[axis].get();

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
      "x" | "y",
      NumericRange,
    ][]) {
      const range = this.range[axis].get();
      const unit = this.#dataUnit[axis];

      const d = toNumeric(range.to, unit) - toNumeric(range.from, unit);

      if (zoom.to - zoom.from <= 0) continue;

      this.range[axis].set(
        toRange(
          {
            from: toNumeric(range.from, unit) + d * zoom.from,
            to: toNumeric(range.from, unit) + d * zoom.to,
          },
          unit,
        ),
      );
    }
  }

  shiftRange({ detail: shift }: { detail: Shift }) {
    {
      const xRange = this.range.x.get();
      const xUnits = this.#dataUnit.x;
      const from = toNumeric(xRange.from, xUnits);
      const to = toNumeric(xRange.to, xUnits);
      if (shift.dx) {
        const delta = (to - from) * -shift.dx;
        this.range.x.set(
          toRange(
            {
              from: from + delta,
              to: to + delta,
            },
            xUnits,
          ),
        );
      }
    }
    {
      const yRange = this.range.y.get();
      const yUnits = this.#dataUnit.y;
      const from = toNumeric(yRange.from, yUnits);
      const to = toNumeric(yRange.to, yUnits);
      if (shift.dy) {
        const delta = (to - from) * -shift.dy;
        this.range.y.set(
          toRange({ from: from + delta, to: to + delta }, yUnits),
        );
      }
    }
  }

  /**
   * Returns IDs of traces below the threshold so they can be hidden
   * if your traces are sin(x) and x^2, then filterByThreshold(1.1) only leaves the x^2
   */
  idsUnderThreshold({ detail: threshold }: { detail: Threshold }): Set<string> {
    const yRange = this.range.y.get();
    const yUnits = this.#dataUnit.y;

    const from = toNumeric(yRange.from, yUnits);
    const to = toNumeric(yRange.to, yUnits);
    const qThreshold = toQuantOrDay(
      from + (to - from) * threshold.thresholdFrac,
      this.#dataUnit.y,
    ) as number | Quantity;
    const traces = this.traces.get();

    const tracesWithThreshold = new Set(
      traces.withOverThreshold(qThreshold).traces(),
    );
    const result = new Set<string>();

    for (const trace of traces.traces()) {
      if (!tracesWithThreshold.has(trace)) {
        result.add(trace);
      }
    }

    return result;
  }

  distanceInPx(a: ChartValuePoint, b: ChartValuePoint) {
    return norm([
      this.quantityToCoordinate(b.x, "x") - this.quantityToCoordinate(a.x, "x"),
      this.quantityToCoordinate(b.y, "y") - this.quantityToCoordinate(a.y, "y"),
    ]);
  }

  readonly raiseXFactorAction: Signal<UnitChangeAction | undefined>;
  readonly lowerXFactorAction: Signal<UnitChangeAction | undefined>;
  readonly resetXFactorAction: Signal<UnitChangeAction | undefined>;
  readonly raiseYFactorAction: Signal<UnitChangeAction | undefined>;
  readonly lowerYFactorAction: Signal<UnitChangeAction | undefined>;
  readonly resetYFactorAction: Signal<UnitChangeAction | undefined>;

  /**
   * A signal that corresponds to the context menu options "Raise unit to..."
   * and "Lower unit to...", it contains the unit to be changed to, and a
   * callback that actually performs the change
   */
  #changeFactorAction = (
    direction: "raise" | "lower",
    axis: "x" | "y",
  ): Signal<UnitChangeAction | undefined> => {
    const displayUnit = this.currentDisplayUnit[axis];

    return displayUnit.map((unit) => {
      const self = this;

      // NOTE changing the factor of a date range is not supported
      if (!unit || unit instanceof NumericDateFormat) return;

      const factorsEqual = (a: FactorDefinition, b: FactorDefinition) =>
        a.mul === b.mul && a.base === b.base && a.exp.equals(b.exp);

      const factors = Object.entries<FactorDefinition>(unit.unitSystem.factors);

      // add prefix-less factor
      factors.push(["(unitless)", { mul: 1, base: 1, exp: new Fraction(1) }]);

      // if the current factor is non-standard, add it to the list
      if (!factors.find(([_, f]) => factorsEqual(unit.factor, f))) {
        factors.push(["(current)", unit.factor]);
      }

      // sort by value
      factors.sort(
        ([_, a], [__, b]) =>
          a.mul * a.base ** +a.exp - b.mul * b.base ** +b.exp,
      );

      const currentIndex = factors.findIndex(([_, f]) =>
        factorsEqual(unit.factor, f),
      );

      const newIndex = currentIndex + (direction === "raise" ? 1 : -1);
      if (newIndex < 0 || newIndex >= factors.length) return;

      const newFactor = factors[newIndex][1];
      const newUnit = unit.withFactor(newFactor);

      return {
        unit: newUnit,
        callback() {
          self.#currentUnitsAreDefault[axis] = false;
          displayUnit.set(newUnit);
        },
      };
    });
  };

  #resetFactorAction = (
    axis: "x" | "y",
  ): Signal<UnitChangeAction | undefined> => {
    const self = this;
    const currentUnit = this.currentDisplayUnit[axis];
    const defaultUnitSettings = this.defaultDisplayUnit[axis];

    return defaultUnitSettings.zip(currentUnit).map(([_def, curr]) => {
      const targetUnit = this.#findResetUnit(axis);

      if (!targetUnit || !curr) return;
      if (targetUnit.isEqual(curr)) return;

      return {
        unit: targetUnit,
        callback() {
          self.#currentUnitsAreDefault[axis] = true;
          currentUnit.set(targetUnit);
        },
      };
    });
  };

  #findResetUnit = (axis: "x" | "y") => {
    const dataUnit = this.#dataUnit[axis];
    const defaultUnitSettings = this.defaultDisplayUnit[axis].get();

    switch (defaultUnitSettings) {
      case "data":
        if (dataUnit instanceof NumericDateFormat) return undefined;
        return dataUnit;

      case "auto":
        return this.bestDisplayUnits(axis);

      default:
        if (isDisplayUnitValidForDataUnit(dataUnit, defaultUnitSettings)) {
          return defaultUnitSettings;
        } else {
          console.warn(
            `The specified display unit "${defaultUnitSettings}" is invalid for the data unit "${dataUnit}"`,
          );
          return dataUnit instanceof NumericDateFormat ? undefined : dataUnit;
        }
    }
  };
}
