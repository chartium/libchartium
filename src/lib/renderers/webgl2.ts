import { lib } from "../wasm.js";
import { type RenderJob, type Renderer } from "./mod.js";
import { LAZY, PARAMS } from "../data/trace-list.js";
import { toNumericRange } from "../units/mod.js";
import type { DataUnit } from "../types.js";
import { yeet } from "@typek/typek";

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
    const stacks = traceList[LAZY].traceHandleStacks;

    const styleSheet = traceList[PARAMS].styles;
    const colorIndices = traceList[LAZY].colorIndices;

    if (job.clear) this.#renderer.clear();

    for (const [stack, handles] of stacks) {
      if (stack === null) {
        const jobMap = new Map<number, lib.WebGlRenderJob>();

        for (const handle of handles) {
          for (const bundle of traceList[PARAMS].bundles) {
            if (!bundle.boxed.contains_trace(handle)) continue;

            let rj = jobMap.get(bundle.boxed.handle());

            if (!rj) {
              const xRange = toNumericRange(job.xRange, bundle.xDataUnit);
              const yRange = toNumericRange(job.yRange, bundle.yDataUnit);

              jobMap.set(
                bundle.boxed.handle(),
                (rj = new lib.WebGlRenderJob({ xRange, yRange })),
              );
            }

            const style = styleSheet.get_cloned(handle);
            const color = styleSheet.get_color(
              handle,
              colorIndices,
              randomSeed,
            );

            rj.add_trace(this.#renderer, bundle.boxed, handle, style, color);
          }
        }

        for (const rj of jobMap.values()) this.#renderer.render(rj);
      } else {
        let result:
          | {
              rj: lib.WebGlRenderJob;
              xDataUnit: DataUnit;
              yDataUnit: DataUnit;
            }
          | undefined;

        for (const handle of handles) {
          for (const bundle of traceList[PARAMS].bundles) {
            if (!bundle.boxed.contains_trace(handle)) continue;

            const xRange = toNumericRange(job.xRange, bundle.xDataUnit);
            const yRange = toNumericRange(job.yRange, bundle.yDataUnit);

            if (!result) {
              result = {
                rj: new lib.WebGlRenderJob({ xRange, yRange }, stack),
                xDataUnit: bundle.xDataUnit,
                yDataUnit: bundle.yDataUnit,
              };
            }

            const style = styleSheet.get_cloned(handle);
            const color = styleSheet.get_color(
              handle,
              colorIndices,
              randomSeed,
            );

            result.rj.add_trace(
              this.#renderer,
              bundle.boxed,
              handle,
              style,
              color,
            );
          }
        }

        if (result) this.#renderer.render(result.rj);
      }
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

  const vertShader = compileShader(
    context,
    context.VERTEX_SHADER,
    `
        attribute vec2 aVertexPosition;
        attribute float aLengthAlong;
        attribute vec2 csoffset;

        varying float vLengthAlong;

        uniform vec2 transform;
        uniform vec2 origin;
        uniform vec2 size;
        uniform vec2 resolution;

        void main() {
            gl_Position = vec4(csoffset / resolution + vec2(-1,-1) + vec2(2,2) * (aVertexPosition * vec2(1,transform.x) + vec2(0, transform.y) - origin) / size, 0, 1);
            gl_PointSize = 8.0;
            vLengthAlong = aLengthAlong;
        }
      `,
  );

  const fragShader = compileShader(
    context,
    context.FRAGMENT_SHADER,
    `
        precision mediump float;
        uniform vec4 color;
        // lengths of the dashes and gaps in pixels, expected to be in order [dash, gap, dash, gap]
        uniform vec4 dashGapLengths;
        varying float vLengthAlong;

        void main() {
            float totalLength = dashGapLengths[0] + dashGapLengths[1] + dashGapLengths[2] + dashGapLengths[3];
            float currentCycleLength = mod(vLengthAlong, totalLength);
            float firstDashGap = dashGapLengths[0] + dashGapLengths[1];
            bool shouldBeDrawn = currentCycleLength < dashGapLengths[0] || (currentCycleLength > firstDashGap && currentCycleLength < firstDashGap + dashGapLengths[2]);
            if (shouldBeDrawn) {
              gl_FragColor.rgb = color.rgb * color.a;
              gl_FragColor.a = color.a;
            }
            else {
              discard;
            }
        }
      `,
  );

  const traceProgram = linkProgram(context, vertShader, fragShader);
  const traceTransform = context.getUniformLocation(traceProgram, "transform")!;
  const traceOrigin = context.getUniformLocation(traceProgram, "origin")!;
  const traceSize = context.getUniformLocation(traceProgram, "size")!;
  const resolution = context.getUniformLocation(traceProgram, "resolution")!;
  const traceCsoffset = context.getAttribLocation(traceProgram, "csoffset")!;
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
    resolution,
  );

  _init = { canvas, context, programs };
  return _init;
}
function ensureCanvasDimensions(width: number, height: number) {
  if (_init.canvas.width < width) _init.canvas.width = width;
  if (_init.canvas.height < height) _init.canvas.height = height;
}
