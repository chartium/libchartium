import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod";
import { mapOpt } from "../../utils/mapOpt";
import type { Range, Tick, TypeOfData, Unit } from "../types";
import type { TraceList } from "../data-worker/trace-list";
import { linearTicks } from "../../utils/ticks";

import { mut } from "@mod.js/signals";
import type {
  Signal,
  Subscriber,
  SignalValue,
  WritableSignal,
} from "@mod.js/signals";

const withSubscriber = <S extends Signal<any>>(
  signal: S,
  sub: Subscriber<SignalValue<S>>
) => {
  signal.subscribe(sub);
  return signal;
};
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
  #controller: ChartiumController | Remote<ChartiumController>;
  get controller() {
    return this.#controller;
  }

  #canvas?: HTMLCanvasElement;
  get canvas() {
    return this.#canvas;
  }

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

  readonly traces: WritableSignal<TraceList>;

  readonly xType: WritableSignal<TypeOfData>;
  readonly xRange: WritableSignal<Range>;
  readonly yRange: WritableSignal<Range>;

  readonly renderAxes: WritableSignal<boolean>;

  constructor(
    controller: ChartiumController | Remote<ChartiumController>,
    traces: TraceList
  ) {
    this.#controller = controller;
    this.#updateTraces(traces);

    this.renderAxes = withEffect(mut(true), this.scheduleRender);

    // TODO estimate xType
    this.xType = withEffect(mut("f32"), this.scheduleRender);

    this.traces = withEffect(mut(traces), (t) => {
      this.#updateTraces(t);
      this.scheduleRender();
    });

    this.xRange = withEffect(mut(traces.range), this.scheduleRender);
    this.yRange = withEffect(mut(traces.getYRange()), this.scheduleRender);
  }

  /** assign a canvas to this render handler and prepares the renderer */
  async assignCanvas(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    let offscreen = this.#canvas?.transferControlToOffscreen();
    this.#renderer = await mapOpt(offscreen, (c) =>
      this.#controller.createRenderer(transfer(c, [c]))
    );
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
    if (this.#renderer === undefined) {
      // renderer gets initialized when canvas is assigned
      throw new Error("Canvas not assigned");
    }

    const renderJob: RenderJob = {
      traces: this.traces.get(),
      xType: this.xType.get(),
      xRange: this.xRange.get(),
      yRange: this.yRange.get(),

      clear: true,
      renderAxes: this.renderAxes.get(),
    };

    this.#renderer.render(renderJob);

    this.#updateTicks();
  }

  tryRender(): boolean {
    if (this.#renderer && this.traces.get()) {
      this.render();
      return true;
    }
    return false;
  }

  scheduleRender = () => {
    // TODO deduplicate renders
    requestAnimationFrame(() => {
      this.tryRender();
    });
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
}
