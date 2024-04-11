import { lib } from "../wasm.js";
import { yeet } from "yeet-ts";
import {
  type RenderJob,
  type Renderer,
  type RenderingController,
} from "./mod.js";
import { LAZY, PARAMS } from "../trace-list.js";
import { filter } from "../../utils/collection.js";
import { toNumericRange } from "../../utils/unit.js";

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

export class WebGL2Controller implements RenderingController {
  readonly #canvas: OffscreenCanvas;
  readonly #context: WebGL2RenderingContext;
  readonly #programs: lib.WebGlPrograms;

  constructor(canvas: OffscreenCanvas) {
    this.#canvas = canvas;

    this.#context =
      this.#canvas.getContext("webgl2", {
        antialias: true,
        premultipliedAlpha: true,
      }) ?? yeet("Could not get a WebGL2 context for an OffscreenCanvas.");

    const {
      traceProgram,
      traceColor,
      traceCsoffset,
      traceOrigin,
      traceSize,
      traceTransform,
      traceDashGapLengths,
    } = this.#initTraceProgram();
    this.#programs = new lib.WebGlPrograms(
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor,
      traceDashGapLengths,
    );
  }

  createRenderer(presentCanvas: OffscreenCanvas): WebGL2Renderer {
    const raw = new lib.WebGlRenderer(
      this.#canvas,
      this.#context,
      this.#programs,
      presentCanvas,
    );
    const wrapped = new WebGL2Renderer(this, this.#context, raw);
    return wrapped;
  }

  #initTraceProgram() {
    const gl = this.#context;

    const vertShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `
      attribute vec2 aVertexPosition;
      attribute float aLengthAlong;
      varying float vLengthAlong;

        uniform vec2 transform;
        uniform vec2 origin;
        uniform vec2 size;

        uniform vec2 csoffset;

        void main() {
            gl_Position = vec4(csoffset + vec2(-1,-1) + vec2(2,2) * (aVertexPosition * vec2(1,transform.x) + vec2(0, transform.y) - origin) / size, 0, 1);
            gl_PointSize = 8.0;
            vLengthAlong = aLengthAlong;
        }
      `,
    );

    const fragShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
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
              gl_FragColor = color;
            }
            else {
              discard;
            }
        }
      `,
    );

    const traceProgram = linkProgram(gl, vertShader, fragShader);
    const traceTransform = gl.getUniformLocation(traceProgram, "transform")!;
    const traceOrigin = gl.getUniformLocation(traceProgram, "origin")!;
    const traceSize = gl.getUniformLocation(traceProgram, "size")!;
    const traceCsoffset = gl.getUniformLocation(traceProgram, "csoffset")!;
    const traceColor = gl.getUniformLocation(traceProgram, "color")!;
    const traceDashGapLengths = gl.getUniformLocation(
      traceProgram,
      "dashGapLengths",
    )!;

    return {
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor,
      traceDashGapLengths,
    };
  }
}

export class WebGL2Renderer implements Renderer {
  readonly #context: WebGL2RenderingContext;
  readonly #renderer: lib.WebGlRenderer;

  constructor(
    public readonly parent: WebGL2Controller,
    context: WebGL2RenderingContext,
    renderer: lib.WebGlRenderer,
  ) {
    this.#context = context;
    this.#renderer = renderer;
  }

  render(job: RenderJob): void {
    const traceList = job.traces;
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
        const color = styleSheet.get_color(handle, colorIndices);

        const data = lib.TraceData.compute(bundle.boxed, handle, xRange);
        const traceBuffer = this.#renderer.create_trace_buffer(data);
        const arcLengthBuffer = this.#renderer.create_arc_length_buffer(
          data,
          yRange,
        );

        rj.add_trace(data, style, color, traceBuffer, arcLengthBuffer);
      }

      this.#renderer.render(rj);
    }
  }

  setSize(width: number, height: number) {
    this.#renderer.set_size(width, height);
  }
}
