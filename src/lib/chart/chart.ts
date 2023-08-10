
import { transfer, type Remote } from "comlink";
import type { ChartiumController } from "../data-worker";
import type { Renderer, TraceDescriptor } from "../data-worker/renderers/mod";
import { mapOpt } from "../../utils/mapOpt";
import type { Range, TraceHandle, TypeOfData } from "../types";

/** Chartium render handler that is to be used by frontend svelte comonents to render charts
 * it autorenders when anything about the chart changes
 */
export class Chart {
    private _controller: Remote<ChartiumController>;
    private _canvas?: HTMLCanvasElement;
    private _renderer?: Renderer;
    private _includedTraces: TraceDescriptor[] = [];
    private _includeBundles?: number[];
    private _excludeTraces?: TraceHandle[];

    private _xType?: TypeOfData;

    private _xRange?: Range;
    private _yRange?: Range;

    private _clear?: boolean;
    private _darkMode?: boolean;
    private _renderAxes?: boolean;
    private _renderGrid?: boolean;

    private _margin?: number;
    private _xLabelSpace?: number;
    private _yLabelSpace?: number;


    constructor(controller: Remote<ChartiumController>) {
        this._controller = controller;
    }

    /** assign a canvas to this render handler and prepares the renderer */
    async assignCanvas(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
        let offscreen = this._canvas?.transferControlToOffscreen();
        this._renderer = await mapOpt(offscreen, (c) => this._controller.createRenderer(transfer(c, [c])));
    }

    /** Render the chart. This gets called automatically if you use any of the setters.
     *  Autocalculates the ranges and estimates type if undefined */
    async render() {
        if (this._renderer === undefined) {
            // renderer gets initialized when canvas is assigned
            throw new Error("Canvas not assigned");
        }

        if (this._xType === undefined) {
            // TODO estimate xType
            this._xType = "f32";
        }

        if (this._includedTraces.length === 0) {
            console.log("No traces to render");
            return;
        }


        // if the ranges are not set, estimate them from ranges of the first trace
        // FIXME This doesnt work, but @m93a will add a function to the controller to help
        const bottomLeft = await this._controller.findClosestPointOfTrace(this._includedTraces[0].handle, { x: -Infinity, y: -Infinity }) ?? { x: 0, y: 0 };
        const topRight = await this._controller.findClosestPointOfTrace(this._includedTraces[0].handle, { x: Infinity, y: Infinity }) ?? { x: 0, y: 0 };
        if (this._xRange === undefined) {
            this._xRange = { from: bottomLeft.x, to: topRight.x };
        }

        if (this._yRange === undefined) {
            this._yRange = { from: bottomLeft.y, to: topRight.y };
        }

        const renderJob = {
            xType: this._xType,
            includeTraces: this._includedTraces,
            includeBundles: this._includeBundles,
            excludeTraces: this._excludeTraces,
            xRange: this._xRange,
            yRange: this._yRange,

            clear: this._clear,
            darkMode: this._darkMode,
            renderAxes: this._renderAxes,
            renderGrid: this._renderGrid,

            margin: this._margin,
            xLabelSpace: this._xLabelSpace,
            yLabelSpace: this._yLabelSpace,
        };

        this._renderer.render(renderJob);
    }

    set includeTraces(traces: TraceDescriptor[]) {
        this._includedTraces = traces;
        this.render()
    }

    set includeBundles(bundles: number[]) {
        this._includeBundles = bundles;
        this.render()
    }

    set excludeTraces(traces: TraceHandle[]) {
        this._excludeTraces = traces;
        this.render()
    }

    set xType(type: TypeOfData) {
        this._xType = type;
        this.render()
    }

    set xRange(range: Range) {
        this._xRange = range;
        this.render()
    }

    set yRange(range: Range) {
        this._yRange = range;
        this.render()
    }

    set clear(value: boolean) {
        this._clear = value;
        this.render();
    }
    set darkMode(value: boolean) {
        this._darkMode = value;
        this.render();
    }
    set renderAxes(value: boolean) {
        this._renderAxes = value;
        this.render();
    }
    set renderGrid(value: boolean) {
        this._renderGrid = value;
        this.render();
    }

    set margin(value: number) {
        this._margin = value;
        this.render();
    }
    set xLabelSpace(value: number) {
        this._xLabelSpace = value;
        this.render();
    }
    set yLabelSpace(value: number) {
        this._yLabelSpace = value;
        this.render();
    }

    //SECTION - getters

    get controller() { return this._controller; }
    get canvas() { return this._canvas; }
    get renderer() { return this._renderer; }
    get includedTraces() { return this._includedTraces; }
    get includeBundles(): number[] | undefined { return this._includeBundles; }
    get excludeTraces(): TraceHandle[] | undefined { return this._excludeTraces; }
    get xType(): TypeOfData | undefined { return this._xType; }
    get xRange(): Range | undefined { return this._xRange; }
    get yRange(): Range | undefined { return this._yRange; }
    get clear(): boolean | undefined { return this._clear; }
    get darkMode(): boolean | undefined { return this._darkMode; }
    get renderAxes(): boolean | undefined { return this._renderAxes; }
    get renderGrid(): boolean | undefined { return this._renderGrid; }
    get margin(): number | undefined { return this._margin; }
    get xLabelSpace(): number | undefined { return this._xLabelSpace; }
    get yLabelSpace(): number | undefined { return this._yLabelSpace; }

}
