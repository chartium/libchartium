
import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker";
import type { Renderer, TraceDescriptor } from "../data-worker/renderers/mod";
import { mapOpt } from "../../utils/mapOpt";
import type { Range, Tick, TraceHandle, TypeOfData } from "../types";
import { createWritableSignal, type WritableSignal, type ReadableSignal } from "../../utils/signal";

/** Chartium render handler that is to be used by frontend svelte comonents to render charts
 * it autorenders when anything about the chart changes
 */
export class Chart {
    #controller: Remote<ChartiumController>;
    #canvas?: HTMLCanvasElement;
    #renderer?: Renderer;
    #includedTraces: TraceDescriptor[] = [];
    #includeBundles?: number[];
    #excludeTraces?: TraceHandle[];

    #xType?: TypeOfData;

    #xRange?: Range;
    #yRange?: Range;

    #clear?: boolean;
    #darkMode?: boolean;
    #renderAxes?: boolean;
    #renderGrid?: boolean;

    #margin?: number;
    #xLabelSpace?: number;
    #yLabelSpace?: number;

    #xTicks?: WritableSignal<Tick[]>;
    #yTicks?: WritableSignal<Tick[]>;

    constructor(controller: Remote<ChartiumController>) {
        this.#controller = controller;
        this.#xTicks = createWritableSignal([]);
        this.#yTicks = createWritableSignal([]);
    }

    /** assign a canvas to this render handler and prepares the renderer */
    async assignCanvas(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
        let offscreen = this.#canvas?.transferControlToOffscreen();
        this.#renderer = await mapOpt(offscreen, (c) => this.#controller.createRenderer(transfer(c, [c])));
    }

    /** Render the chart. This gets called automatically if you use any of the setters.
     *  Autocalculates the ranges and estimates type if undefined */
    async render() {
        if (this.#renderer === undefined) {
            // renderer gets initialized when canvas is assigned
            throw new Error("Canvas not assigned");
        }

        if (this.#xType === undefined) {
            // TODO estimate xType
            this.#xType = "f32";
        }

        if (this.#includedTraces.length === 0) {
            console.log("No traces to render");
            return;
        }


        // if the ranges are not set, estimate them from ranges of the first trace
        // FIXME This doesnt work, but @m93a will add a function to the controller to help
        const bottomLeft = await this.#controller.findClosestPointOfTrace(this.#includedTraces[0].handle, { x: -Infinity, y: -Infinity }) ?? { x: 0, y: 0 };
        const topRight = await this.#controller.findClosestPointOfTrace(this.#includedTraces[0].handle, { x: Infinity, y: Infinity }) ?? { x: 0, y: 0 };
        if (this.#xRange === undefined) {
            this.#xRange = { from: bottomLeft.x, to: topRight.x };
        }

        if (this.#yRange === undefined) {
            this.#yRange = { from: bottomLeft.y, to: topRight.y };
        }

        const renderJob = {
            xType: this.#xType,
            includeTraces: this.#includedTraces,
            includeBundles: this.#includeBundles,
            excludeTraces: this.#excludeTraces,
            xRange: this.#xRange,
            yRange: this.#yRange,

            clear: this.#clear,
            darkMode: this.#darkMode,
            renderAxes: this.#renderAxes,
            renderGrid: this.#renderGrid,

            margin: this.#margin,
            xLabelSpace: this.#xLabelSpace,
            yLabelSpace: this.#yLabelSpace,
        };

        const renderResults = await this.#renderer.render(renderJob);
        this.#xTicks?.set(renderResults.xTicks);
        this.#yTicks?.set( renderResults.yTicks );
    }

    //SECTION - setters

    set includeTraces(traces: TraceDescriptor[]) {
        this.#includedTraces = traces;
        this.render()
    }

    set includeBundles(bundles: number[]) {
        this.#includeBundles = bundles;
        this.render()
    }

    set excludeTraces(traces: TraceHandle[]) {
        this.#excludeTraces = traces;
        this.render()
    }

    set xType(type: TypeOfData) {
        this.#xType = type;
        this.render()
    }

    set xRange(range: Range) {
        this.#xRange = range;
        this.render()
    }

    set yRange(range: Range) {
        this.#yRange = range;
        this.render()
    }

    set clear(value: boolean) {
        this.#clear = value;
        this.render();
    }
    set darkMode(value: boolean) {
        this.#darkMode = value;
        this.render();
    }
    set renderAxes(value: boolean) {
        this.#renderAxes = value;
        this.render();
    }
    set renderGrid(value: boolean) {
        this.#renderGrid = value;
        this.render();
    }

    set margin(value: number) {
        this.#margin = value;
        this.render();
    }
    set xLabelSpace(value: number) {
        this.#xLabelSpace = value;
        this.render();
    }
    set yLabelSpace(value: number) {
        this.#yLabelSpace = value;
        this.render();
    }

    //SECTION - getters

    get controller() { return this.#controller; }
    get canvas() { return this.#canvas; }
    get renderer() { return this.#renderer; }
    get includedTraces() { return this.#includedTraces; }
    get includeBundles(): number[] | undefined { return this.#includeBundles; }
    get excludeTraces(): TraceHandle[] | undefined { return this.#excludeTraces; }
    get xType(): TypeOfData | undefined { return this.#xType; }
    get xRange(): Range | undefined { return this.#xRange; }
    get yRange(): Range | undefined { return this.#yRange; }
    get clear(): boolean | undefined { return this.#clear; }
    get darkMode(): boolean | undefined { return this.#darkMode; }
    get renderAxes(): boolean | undefined { return this.#renderAxes; }
    get renderGrid(): boolean | undefined { return this.#renderGrid; }
    get margin(): number | undefined { return this.#margin; }
    get xLabelSpace(): number | undefined { return this.#xLabelSpace; }
    get yLabelSpace(): number | undefined { return this.#yLabelSpace; }
    get xTicks(): ReadableSignal<Tick[]> | undefined { return this.#xTicks?.toReadable(); }
    get yTicks(): ReadableSignal<Tick[]> | undefined { return this.#yTicks?.toReadable(); }

}
