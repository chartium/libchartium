import { lib } from "../wasm.ts";
import { yeet } from "../../../utils/yeet.ts";
import {
  deserializeRenderJob,
  type RenderJob,
  type RenderJobResult,
  type Renderer,
  type RenderingController,
} from "./mod.ts";
import { proxyMarker } from "comlink";

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

  readonly #dataModule: lib.DataModule;
  readonly #canvas: OffscreenCanvas;
  readonly #context: WebGL2RenderingContext;
  readonly #programs: lib.WebGlPrograms;

  #renderers: { [key: number]: WebGL2Renderer } = {};
  #availableRendererHandle = 0;

  constructor(dataModule: lib.DataModule, canvas: OffscreenCanvas) {
    this.#dataModule = dataModule;
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
    const { axisProgram, axisColor, axisResolution } = this.#initAxisProgram();
    this.#programs = new lib.WebGlPrograms(
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor,
      axisProgram,
      axisResolution,
      axisColor
    );
  }

  createRenderer(presentCanvas: OffscreenCanvas): WebGL2Renderer {
    const raw = new lib.WebGlRenderer(
      this.#canvas,
      this.#context,
      this.#programs,
      presentCanvas,
      false
    );
    const handle = this.#availableRendererHandle++;
    const wrapped = new WebGL2Renderer(this, handle, this.#dataModule, raw);
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

  #initAxisProgram() {
    const gl = this.#context;

    const vertShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `
        attribute vec2 aVertexPosition;
        uniform vec2 resolution;

        void main() {
            gl_Position = vec4(vec2(-1, -1) + vec2(2, 2) * aVertexPosition / resolution, 0, 1);
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

    const axisProgram = linkProgram(gl, vertShader, fragShader);
    const axisResolution = gl.getUniformLocation(axisProgram, "resolution")!;
    const axisColor = gl.getUniformLocation(axisProgram, "color")!;

    return { axisProgram, axisResolution, axisColor };
  }
}

export class WebGL2Renderer implements Renderer {
  [proxyMarker] = true;

  readonly #dataModule: lib.DataModule;
  readonly #renderer: lib.WebGlRenderer;

  constructor(
    public readonly parent: WebGL2Controller,
    public readonly handle: number,
    dataModule: lib.DataModule,
    renderer: lib.WebGlRenderer
  ) {
    this.#dataModule = dataModule;
    this.#renderer = renderer;
  }

  render(job: RenderJob): RenderJobResult {
    return this.#renderer.render(this.#dataModule, deserializeRenderJob(job));
  }
}
