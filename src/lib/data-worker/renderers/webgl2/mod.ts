import { lib } from "../../wasm.js";
import { yeet } from "yeet-ts";
import { type RenderJob, type Renderer } from "../mod.js";
import { LAZY, PARAMS } from "../../trace-list.js";
import { filter } from "../../../utils/collection.js";
import { toNumericRange } from "../../../utils/unit.js";

import frag from "./main.frag";
import vert from "./main.vert";

export function createRenderer(presentCanvas: OffscreenCanvas): WebGL2Renderer {
  const { canvas, context, programs } = init();
  return new WebGL2Renderer(
    new lib.WebGlRenderer(canvas, context, programs, presentCanvas),
  );
}

export class WebGL2Renderer implements Renderer {
  readonly #renderer: lib.WebGlRenderer;

  constructor(renderer: lib.WebGlRenderer) {
    this.#renderer = renderer;
  }

  render(job: RenderJob): void {
    const traceList = job.traces;
    const randomSeed = traceList.randomSeed;
    const availableHandles = traceList[LAZY].handlesSet;

    const styleSheet = traceList[PARAMS].styles;
    const colorIndices = traceList[LAZY].colorIndices;

    let clear = job.clear;
    for (const bundle of traceList[PARAMS].bundles) {
      const xRange = toNumericRange(job.xRange, bundle.xDataUnit);
      const yRange = toNumericRange(job.yRange, bundle.yDataUnit);
      const rj = new lib.WebGlRenderJob({ clear, xRange, yRange });
      clear = false;

      const handles = filter(bundle.traces, (h) => availableHandles.has(h));

      for (const handle of handles) {
        const style = styleSheet.get_cloned(handle);
        const color = styleSheet.get_color(handle, colorIndices, randomSeed);

        const geometry = this.#renderer.get_trace_geometry(
          bundle.boxed,
          handle,
          style,
          xRange,
          yRange,
        );

        rj.add_trace(style, color, geometry);
      }

      this.#renderer.render(rj);
    }
  }

  setSize(width: number, height: number) {
    ensureCanvasDimensions(width, height);
    this.#renderer.set_size(width, height);
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
function linkProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  return program;
}

let _init: {
  canvas: OffscreenCanvas;
  context: WebGL2RenderingContext;
  programs: lib.WebGlPrograms;
};
function init() {
  if (_init) return _init;

  const canvas = new OffscreenCanvas(640, 480);
  const context =
    canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
    }) ?? yeet("Could not get a WebGL2 context for an OffscreenCanvas.");

  const vertShader = compileShader(context, context.VERTEX_SHADER, vert);
  const fragShader = compileShader(context, context.FRAGMENT_SHADER, frag);

  const traceProgram = linkProgram(context, vertShader, fragShader);
  const traceTransform = context.getUniformLocation(traceProgram, "transform")!;
  const traceOrigin = context.getUniformLocation(traceProgram, "origin")!;
  const traceSize = context.getUniformLocation(traceProgram, "size")!;
  const traceCsoffset = context.getUniformLocation(traceProgram, "csoffset")!;
  const traceColor = context.getUniformLocation(traceProgram, "color")!;
  const traceDashGapLengths = context.getUniformLocation(
    traceProgram,
    "dashGapLengths",
  )!;

  const programs = new lib.WebGlPrograms(
    traceProgram,
    traceTransform,
    traceOrigin,
    traceSize,
    traceCsoffset,
    traceColor,
    traceDashGapLengths,
  );

  _init = { canvas, context, programs };
  return _init;
}
function ensureCanvasDimensions(width: number, height: number) {
  if (_init.canvas.width < width) _init.canvas.width = width;
  if (_init.canvas.height < height) _init.canvas.height = height;
}
