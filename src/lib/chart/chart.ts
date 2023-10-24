import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker/index.js";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod.js";
import type {
  DateRange,
  NumericRange,
  QuantityRange,
  Range,
  Tick,
  Unit,
} from "../types.js";
import { Quantity } from "../types.js";
import { TraceList } from "../data-worker/trace-list.js";
import {
  linearDateTicks,
  linearQuantityTicks,
  linearTicks,
} from "../utils/ticks.js";
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
  toDateRange,
  toDayjs,
  toNumeric,
  toNumericRange,
  toQuantOrDay,
  toRange,
} from "../utils/quantityHelpers.js";
import dayjs, { Dayjs } from "dayjs";

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
const withEffect = <S extends Signal<any>>(
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

  readonly xDisplayUnit = mut<Unit | "date">();
  readonly yDisplayUnit = mut<Unit | "date">();

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

  constructor(
    public readonly controller: ChartiumController | Remote<ChartiumController>,
    public readonly canvas: OffscreenCanvas,
    traces?: TraceList
  ) {
    // signals
    traces ??= TraceList.empty();

    this.traces = withSubscriber(mut(traces), (t) => this.#updateTraces(t));
    this.xRange = withEffect(mut(traces.range), this.scheduleRender);
    this.yRange = withEffect(mut(traces.getYRange()), this.scheduleRender);

    this.size = withEffect(
      mut({ width: NaN, height: NaN }),
      ({ width, height }) => {
        this.#renderer?.setSize(width, height);
        this.scheduleRender();
      }
    );

    withEffect(this.xDisplayUnit, () => this.#updateTicks());
    withEffect(this.yDisplayUnit, () => this.#updateTicks());

    // canvas & renderer
    this.controller.createRenderer(transfer(canvas, [canvas])).then((r) => {
      this.#renderer = r;
      this.scheduleRender();
    });

    this.raiseXFactorAction = changeFactorAction(
      "raise",
      this.xRange,
      this.xDisplayUnit
    );
    this.lowerXFactorAction = changeFactorAction(
      "lower",
      this.xRange,
      this.xDisplayUnit
    );
    this.raiseYFactorAction = changeFactorAction(
      "raise",
      this.yRange,
      this.yDisplayUnit
    );
    this.lowerYFactorAction = changeFactorAction(
      "lower",
      this.yRange,
      this.yDisplayUnit
    );
  }

  #updateTraces(traces: TraceList) {
    const someUnits = traces.getUnits()[0];
    this.xDisplayUnit.set(someUnits?.x);
    this.yDisplayUnit.set(someUnits?.y);
    this.scheduleRender(); // FIXME check that this is good
  }

  /**
   * Render the chart. This gets called automatically if you use any of the setters.
   *  Autocalculates the ranges and estimates type if undefined
   */
  render() {
    console.log("render");

    if (this.#renderer === undefined) {
      // renderer gets initialized when canvas is assigned
      throw new Error("Canvas not assigned");
    }

    // clear canvas // FIXME just clear it normally u dummy
    const clearJob: RenderJob = {
      xType: "f32",
      traces: TraceList.empty(),
      clear: true,
    };
    this.#renderer.render(clearJob);

    for (const [units, traces] of this.traces.get().getUnitsToTraceMap()) {
      const renderJob: RenderJob = {
        traces: traces,

        // TODO read xType
        xType: "f32",
        xRange: toNumericRange(this.xRange.get(), units.x),
        yRange: toNumericRange(this.yRange.get(), units.y),

        clear: false,
      };

      this.#renderer.render(renderJob);
    }

    this.#updateTicks();
  }

  tryRender(): boolean {
    console.log("try render");

    if (this.#renderer) {
      this.render();
      return true;
    }
    return false;
  }

  #renderScheduled = false;
  scheduleRender = async () => {
    console.log("schedule render");

    // render already scheduled
    if (this.#renderScheduled) return;

    this.#renderScheduled = true;
    await nextAnimationFrame();
    this.#renderScheduled = false;
    this.tryRender();
  };

  readonly #xTicks = mut<Tick[]>([]);
  readonly #yTicks = mut<Tick[]>([]);
  readonly xTicks = this.#xTicks.toReadonly();
  readonly yTicks = this.#yTicks.toReadonly();

  #updateTicks() {
    const xRange = this.xRange.get();
    if (xRange) {
      const unit = this.xDisplayUnit.get();
      this.#xTicks.set(linearTicks(xRange, unit, undefined));
    }

    const yRange = this.yRange.get();
    if (yRange) {
      const unit = this.yDisplayUnit.get();
      this.#yTicks.set(linearTicks(yRange, unit, undefined));
    }
  }

  resetZoom() {
    const units = this.bestDisplayUnits();
    this.xRange.set(toRange(this.traces.get().range, units.x));
    this.yRange.set(toRange(this.traces.get().getYRange(), units.y));
    this.xDisplayUnit.set(units.x);
    this.yDisplayUnit.set(units.y);
    return this.scheduleRender();
  }

  bestDisplayUnits(): {
    x: Unit | "date" | undefined;
    y: Unit | "date" | undefined;
  } {
    // FIXME recognize when to use date
    const units = this.traces.get().getUnits();
    const xUnits = units.map((u) => u.x);
    const yUnits = units.map((u) => u.y);
    let medianXUnit;
    if (xUnits[0] === "date" || xUnits[0] === undefined) {
      medianXUnit = xUnits[0];
    } else {
      xUnits.sort(
        (a, b) =>
          (a as Unit).multiplyValueByFactor(1) - //FIXME this cant be the right way
          (b as Unit).multiplyValueByFactor(1) //FIXME this cant be the right way
      )[Math.floor(xUnits.length / 2)];
    }

    let medianYUnit;
    if (yUnits[0] === "date" || yUnits[0] === undefined) {
      medianYUnit = yUnits[0];
    } else {
      yUnits.sort(
        (a, b) =>
          (a as Unit).multiplyValueByFactor(1) - //FIXME this cant be the right way
          (b as Unit).multiplyValueByFactor(1) //FIXME this cant be the right way
      )[Math.floor(yUnits.length / 2)];
    }

    return {
      //x: medianXUnit, // FIXME DEBUG
      x: "date",
      y: medianYUnit,
    };
  }

  /** Transforms x, y fraction of canvas size into chart quantity (or unitless number) */
  fractionsToQuantities(
    fraction: number,
    axis: "x" | "y"
  ): Quantity | dayjs.Dayjs | number {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    if (!range) throw new Error(`${axis} range is undefined`);
    const unit =
      axis === "x" ? this.bestDisplayUnits().x : this.bestDisplayUnits().y;

    const value =
      toNumeric(range.from, unit) +
      (axis === "x" ? fraction : 1 - fraction) *
        (toNumeric(range.to, unit) - toNumeric(range.from, unit));

    if (unit === "date") {
      return toDayjs(value);
    }
    return toQuantOrDay(value, unit);
  }

  /** Transforms x, y of chart quantity (or unitless number) into fraction of canvas size */
  quantitiesToFractions(
    quantity: Quantity | dayjs.Dayjs | number,
    axis: "x" | "y"
  ): number {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    if (!range) throw new Error(`${axis} range is undefined`);
    const unit =
      axis === "x" ? this.xDisplayUnit.get() : this.yDisplayUnit.get();

    const fraction =
      (toNumeric(quantity, unit) - toNumeric(range.from, unit)) /
      (toNumeric(range.to) - toNumeric(range.from));

    return fraction;
  }

  /** Transforms x, y pixel coordinates (relative to chart canvas) of a point into the x, y quantities or numbers */
  coordinatesToQuantities(
    coordinateInPx: number,
    axis: "x" | "y"
  ): Quantity | number | dayjs.Dayjs {
    const range = axis === "x" ? this.xRange.get() : this.yRange.get();
    const displayUnit =
      axis === "x" ? this.xDisplayUnit.get() : this.yDisplayUnit.get();

    if (!range) throw new Error("xRange or yRange is undefined");

    const value =
      toNumeric(range.from, displayUnit) +
      (axis === "x"
        ? coordinateInPx / this.canvas!.width
        : 1 - coordinateInPx / this.canvas!.height) *
        (toNumeric(range.to, displayUnit) - toNumeric(range.from, displayUnit));
    if (displayUnit === "date") {
      return toDayjs(value);
    }
    return toQuantOrDay(value, displayUnit);
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
      axis === "x" ? this.xDisplayUnit.get() : this.yDisplayUnit.get();

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

  readonly raiseXFactorAction: ReturnType<typeof changeFactorAction>;
  readonly lowerXFactorAction: ReturnType<typeof changeFactorAction>;
  readonly raiseYFactorAction: ReturnType<typeof changeFactorAction>;
  readonly lowerYFactorAction: ReturnType<typeof changeFactorAction>;
}

/**
 * A signal that corresponds to the context menu options "Raise unit to..."
 * and "Lower unit to...", it contains the unit to be changed to, and a
 * callback that actually performs the change
 */
const changeFactorAction = (
  direction: "raise" | "lower",
  range: WritableSignal<Range>,
  displayUnit: WritableSignal<Unit | "date" | undefined> // FIXME this doesnt feel like the best solution, think of a better one
) =>
  range.map(($range) => {
    if (!$range) return;
    if ($range.from instanceof dayjs || displayUnit.get() === "date") return; // NOTE changing the factor of a date range is not supported
    const unit = $range.from instanceof Quantity ? $range.from.unit : undefined;
    if (!unit) return;

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
      callback: () => {
        range.set(toRange($range as NumericRange | QuantityRange, newUnit));
        displayUnit.set(newUnit);
      },
    };
  });
