import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker";
import type { RenderJob, Renderer } from "../data-worker/renderers/mod";
import { mapOpt } from "../../utils/mapOpt";
import type { Range, Tick, TypeOfData, Unit } from "../types";
import {
  createWritableSignal,
  type WritableSignal,
  type ReadableSignal,
} from "../../utils/signal";
import type { TraceList } from "../data-worker/trace-list";
import { linearTicks } from "../../utils/ticks";

/**
 * Chartium render handler that is to be used by frontend svelte comonents to render charts.
 * It automatically re-renders when anything about the chart changes.
 */
export class Chart {
  #controller: ChartiumController | Remote<ChartiumController>;
  #canvas?: HTMLCanvasElement;
  #renderer?: Renderer;
  #traces!: TraceList;

  #xType?: TypeOfData;

  #xRange?: Range;
  #yRange?: Range;

  #renderAxes?: boolean;

  readonly #xTicks = createWritableSignal<Tick[]>([]);
  readonly #yTicks = createWritableSignal<Tick[]>([]);
  readonly xTicks = this.#xTicks.toReadable();
  readonly yTicks = this.#yTicks.toReadable();

  #xDataUnit: Unit | undefined;
  #yDataUnit: Unit | undefined;
  readonly #xDisplayUnit = createWritableSignal<Unit>();
  readonly #yDisplayUnit = createWritableSignal<Unit>();
  readonly xDisplayUnit = this.#xDisplayUnit.toReadable();
  readonly yDisplayUnit = this.#yDisplayUnit.toReadable();

  constructor(
    controller: ChartiumController | Remote<ChartiumController>,
    traces: TraceList
  ) {
    this.#controller = controller;
    this.#updateTraces(traces);
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

    console.log(traces.getUnits());

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

    this.#traces = traces;
    return this.tryRender();
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

    if (this.#xType === undefined) {
      // TODO estimate xType
      this.#xType = "f32";
    }

    // if the ranges are not set, estimate them from ranges of the first trace
    // FIXME This doesnt work, but @m93a will add a function to the controller to help
    const bottomLeft = /*(await this.#controller.findClosestPointOfTrace(
      this.#includedTraces[0].handle,
      { x: -Infinity, y: -Infinity }
    )) ??*/ { x: 0, y: 0 };
    const topRight = /*(await this.#controller.findClosestPointOfTrace(
      this.#includedTraces[0].handle,
      { x: Infinity, y: Infinity }
    )) ??*/ { x: 0, y: 0 };
    if (this.#xRange === undefined) {
      this.#xRange = { from: bottomLeft.x, to: topRight.x };
    }

    if (this.#yRange === undefined) {
      this.#yRange = { from: bottomLeft.y, to: topRight.y };
    }

    const renderJob: RenderJob = {
      xType: this.#xType,
      traces: this.#traces,
      xRange: this.#xRange,
      yRange: this.#yRange,

      clear: true,
      renderAxes: this.#renderAxes,
    };

    this.#renderer.render(renderJob);

    this.#updateTicks();
  }

  tryRender(): boolean {
    if (this.#renderer) {
      this.render();
      return true;
    }
    return false;
  }

  #updateTicks() {
    this.#xTicks?.set(
      linearTicks(this.xRange!, this.#xDataUnit, this.#xDisplayUnit.get())
    );
    this.#yTicks?.set(
      linearTicks(this.yRange!, this.#yDataUnit, this.#yDisplayUnit.get())
    );
  }

  resetZoom() {
    this.#xRange = this.traces.range;
    this.#yRange = this.traces.getYRange();
    return this.tryRender();
  }

  get controller() {
    return this.#controller;
  }
  get canvas() {
    return this.#canvas;
  }
  get renderer() {
    return this.#renderer;
  }

  get traces() {
    return this.#traces;
  }
  set traces(t: TraceList) {
    this.#updateTraces(t);
  }

  get xType(): TypeOfData | undefined {
    return this.#xType;
  }
  set xType(type: TypeOfData) {
    this.#xType = type;
    this.tryRender();
  }

  get xRange(): Range | undefined {
    return this.#xRange;
  }
  set xRange(range: Range) {
    this.#xRange = range;
    this.tryRender();
  }

  get yRange(): Range | undefined {
    return this.#yRange;
  }
  set yRange(range: Range) {
    this.#yRange = range;
    this.tryRender();
  }

  get renderAxes(): boolean | undefined {
    return this.#renderAxes;
  }
  set renderAxes(value: boolean) {
    this.#renderAxes = value;
    this.tryRender();
  }
}
