import { lib } from "../wasm.js";
import { yeet } from "../../../utils/yeet.js";
import {
  type RenderJob,
  type RenderJobResult,
  type Renderer,
  type RenderingController,
} from "./mod.js";
import { proxyMarker } from "comlink";
import { BUNDLES, HANDLES, TRACE_INFO, TraceList } from "../trace-list.ts";
import {
  concat,
  filter,
  map,
  reduce,
  unique,
} from "../../../utils/collection.ts";
import { computeStyles } from "../trace-styles.ts";
import { traceIds } from "../controller.js";
import type { BoxedBundle } from "../../../../src-rust/pkg/libchartium.ts";
import type { TraceHandle } from "../../types.ts";

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
function linkProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  return program;
}

export class WebGL2Controller implements RenderingController {
  [proxyMarker] = true;

  readonly #canvas: OffscreenCanvas;
  readonly #context: WebGL2RenderingContext;
  readonly #programs: lib.WebGlPrograms;

  #renderers: { [key: number]: WebGL2Renderer } = {};
  #availableRendererHandle = 0;

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
    } = this.#initTraceProgram();
    this.#programs = new lib.WebGlPrograms(
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor
    );
  }

  createRenderer(presentCanvas: OffscreenCanvas): WebGL2Renderer {
    const raw = new lib.WebGlRenderer(
      this.#canvas,
      this.#context,
      this.#programs,
      presentCanvas
    );
    const handle = this.#availableRendererHandle++;
    const wrapped = new WebGL2Renderer(this, handle, this.#context, raw);
    this.#renderers[handle] = wrapped;
    return wrapped;
  }

  #initTraceProgram() {
    const gl = this.#context;

    const vertShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `
        attribute vec2 aVertexPosition;

        uniform vec2 transform;
        uniform vec2 origin;
        uniform vec2 size;

        uniform vec2 csoffset;

        void main() {
            gl_Position = vec4(csoffset + vec2(-1,-1) + vec2(2,2) * (aVertexPosition * vec2(1,transform.x) + vec2(0, transform.y) - origin) / size, 0, 1);
            gl_PointSize = 8.0;
        }
      `
    );

    const fragShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `
        precision mediump float;
        uniform vec4 color;

        void main() {
            gl_FragColor = color;
        }
      `
    );

    const traceProgram = linkProgram(gl, vertShader, fragShader);
    const traceTransform = gl.getUniformLocation(traceProgram, "transform")!;
    const traceOrigin = gl.getUniformLocation(traceProgram, "origin")!;
    const traceSize = gl.getUniformLocation(traceProgram, "size")!;
    const traceCsoffset = gl.getUniformLocation(traceProgram, "csoffset")!;
    const traceColor = gl.getUniformLocation(traceProgram, "color")!;

    return {
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor,
    };
  }
}

export class WebGL2Renderer implements Renderer {
  [proxyMarker] = true;

  readonly #context: WebGL2RenderingContext;
  readonly #renderer: lib.WebGlRenderer;

  readonly #buffers = new WeakMap<
    BoxedBundle,
    Map<TraceHandle, Map</* width */ number, WebGLBuffer>>
  >();

  constructor(
    public readonly parent: WebGL2Controller,
    public readonly handle: number,
    context: WebGL2RenderingContext,
    renderer: lib.WebGlRenderer
  ) {
    this.#context = context;
    this.#renderer = renderer;
  }

  render(job: RenderJob): RenderJobResult {
    const traceList = job.traces;
    const availableHandles = new Set(traceList[HANDLES]);
    const rj = new lib.WebGlRenderJob(job.xType);
    const xRange = job.xRange ?? traceList.range;

    // prettier-ignore
    const yRange = job.yRange ?? (() => {
      const metas = traceList.calculateMetas(xRange);
      const from = reduce(map(metas, (m) => m.min), Math.min);
      const to = reduce(map(metas, (m) => m.max), Math.max);
      return { from, to };
    })();

    rj.x_from = xRange.from;
    rj.x_to = xRange.to;
    rj.y_from = yRange.from;
    rj.y_to = yRange.to;

    for (const bundle of traceList[BUNDLES]) {
      const handles = Array.from(
        filter(bundle.traces() as Iterable<TraceHandle>, (h) =>
          availableHandles.has(h)
        )
      );
      const styles = computeStyles(traceList[TRACE_INFO], handles, traceIds);
      const buffers = map(handles, (h) =>
        lib.WebGlRenderer.create_trace_buffer(this.#context, bundle, h)
      );
      rj.add_traces(bundle, handles.length, buffers, styles);
    }

    if (job.clear !== undefined) rj.clear = job.clear;

    this.#renderer.render(rj);
    return {};
  }

  setSize(width: number, height: number) {
    this.#renderer.set_size(width, height);
  }
}
