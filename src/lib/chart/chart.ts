import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod";
import { mapOpt } from "../../utils/mapOpt";
import type { Range, Tick, Unit } from "../types";
import { TraceList } from "../data-worker/trace-list";
import { linearTicks } from "../../utils/ticks";

import { mut } from "@mod.js/signals";
import type {
  Signal,
  Subscriber,
  SignalValue,
  WritableSignal,
} from "@mod.js/signals";
import { nextAnimationFrame } from "../../utils/promise";
import type { FactorDefinition } from "unitlib";

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

  #xDataUnit: Unit | undefined;
  #yDataUnit: Unit | undefined;
  readonly #xDisplayUnit = mut<Unit>();
  readonly #yDisplayUnit = mut<Unit>();
  readonly xDisplayUnit = this.#xDisplayUnit.toReadonly();
  readonly yDisplayUnit = this.#yDisplayUnit.toReadonly();

  /**
   * The list of traces to be rendered in this chart.
   */
  readonly traces: WritableSignal<TraceList>;

  /**
   * The visible range of the x axis, changes with user interaction
   * (eg. zooming and panning). To reset both axes to fit the data,
   * use the `resetZoom` method.
   */
  readonly xRange: WritableSignal<Range>;

  /**
   * The visible range of the y axis, changes with user interaction
   * (eg. zooming and panning). To reset both axes to fit the data,
   * use the `resetZoom` method.
   */
  readonly yRange: WritableSignal<Range>;

  /**
   * The dimensions of this chart in pixels.
   */
  readonly size: WritableSignal<{ width: number; height: number }>;

  constructor(
    public readonly controller: ChartiumController | Remote<ChartiumController>,
    public readonly canvas: HTMLCanvasElement,
    traces?: TraceList
  ) {
    traces ??= TraceList.empty();

    this.#updateTraces(traces);

    this.traces = withEffect(mut(traces), (t) => {
      this.#updateTraces(t);
      this.scheduleRender();
    });

    this.xRange = withEffect(mut(traces.range), this.scheduleRender);
    this.yRange = withEffect(mut(traces.getYRange()), this.scheduleRender);

    this.size = withEffect(
      mut({ width: NaN, height: NaN }),
      ({ width, height }) => {
        this.#renderer?.setSize(width, height);
        this.scheduleRender();
      }
    );

    const offscreen = canvas.transferControlToOffscreen();
    this.controller
      .createRenderer(transfer(offscreen, [offscreen]))
      .then((r) => {
        this.#renderer = r;
        this.scheduleRender();
      });
  }

  #updateTraces(traces: TraceList) {
    const areUnitsEqual = (
      a: Unit | undefined,
      b: Unit | undefined
    ): boolean => {
      if (!a || !b) return a === b;
      return a.isEqual(b);
    };

    const {
      x: [newXUnit],
      y: [newYUnit],
    } = traces.getUnits();
    if (!areUnitsEqual(newXUnit, this.#xDataUnit)) {
      this.#xDataUnit = newXUnit;
      this.#xDisplayUnit.set(newXUnit);
    }
    if (!areUnitsEqual(newYUnit, this.#yDataUnit)) {
      this.#yDataUnit = newYUnit;
      this.#yDisplayUnit.set(newYUnit);
    }
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

    const renderJob: RenderJob = {
      traces: this.traces.get(),

      // TODO read xType
      xType: "f32",
      xRange: this.xRange.get(),
      yRange: this.yRange.get(),

      clear: true,
    };

    this.#renderer.render(renderJob);

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
      this.#xTicks?.set(
        linearTicks(xRange, this.#xDataUnit, this.#xDisplayUnit.get())
      );
    }

    const yRange = this.yRange.get();
    if (yRange) {
      this.#yTicks?.set(
        linearTicks(yRange, this.#yDataUnit, this.#yDisplayUnit.get())
      );
    }
  }

  resetZoom() {
    this.xRange.set(this.traces.get().range);
    this.yRange.set(this.traces.get().getYRange());
    return this.scheduleRender();
  }

  readonly raiseXFactorAction = changeFactorAction("raise", this.#xDisplayUnit);
  readonly lowerXFactorAction = changeFactorAction("lower", this.#xDisplayUnit);
  readonly raiseYFactorAction = changeFactorAction("raise", this.#yDisplayUnit);
  readonly lowerYFactorAction = changeFactorAction("lower", this.#yDisplayUnit);
}

/**
 * A signal that corresponds to the context menu options "Raise unit to..."
 * and "Lower unit to...", it contains the unit to be changed to, and a
 * callback that actually performs the change
 */
const changeFactorAction = (
  direction: "raise" | "lower",
  unit: WritableSignal<Unit | undefined>
) =>
  unit.map(($unit) => {
    if (!$unit) return;

    const factorsEqual = (a: FactorDefinition, b: FactorDefinition) =>
      a.mul === b.mul && a.base === b.base && a.exp === b.exp;

    const factors = Object.entries<FactorDefinition>($unit.unitSystem.factors);

    // add prefix-less factor
    factors.push(["(unitless)", { mul: 1, base: 1, exp: 1 }]);

    // if the current factor is non-standard, add it to the list
    if (!factors.find(([_, f]) => factorsEqual($unit.factor, f))) {
      factors.push(["(current)", $unit.factor]);
    }

    // sort by value
    factors.sort(
      ([_, a], [__, b]) => a.mul * a.base ** a.exp - b.mul * b.base ** b.exp
    );

    const currentIndex = factors.findIndex(([_, f]) =>
      factorsEqual($unit.factor, f)
    );

    const newIndex = currentIndex + (direction === "raise" ? 1 : -1);
    if (newIndex < 0 || newIndex >= factors.length) return;

    const newFactor = factors[newIndex][1];
    const newUnit = $unit.withFactor(newFactor);

    return {
      unit: newUnit,
      callback: () => unit.set(newUnit),
    };
  });
