import { yeet } from "../../../utils/yeet";

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

export class WebGL2Mode {
  #canvas: OffscreenCanvas;
  #context: WebGL2RenderingContext;

  constructor(canvas: OffscreenCanvas) {
    this.#canvas = canvas;

    this.#context =
      this.#canvas.getContext("webgl2", {
        antialias: true,
        premultipliedAlpha: true,
      }) ?? yeet("Could not get a WebGL2 context for an OffscreenCanvas.");
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
    const traceTransform = gl.getUniformLocation(traceProgram, "transform");
    const traceOrigin = gl.getUniformLocation(traceProgram, "origin");
    const traceSize = gl.getUniformLocation(traceProgram, "size");
    const traceCsoffset = gl.getUniformLocation(traceProgram, "csoffset");
    const traceColor = gl.getUniformLocation(traceProgram, "color");

    return {
      traceProgram,
      traceTransform,
      traceOrigin,
      traceSize,
      traceCsoffset,
      traceColor,
    };
  }

  #initAxisProgram(): WebGLProgram {
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
    const axisResolution = gl.getUniformLocation(axisProgram, "resolution");
    const axisColor = gl.getUniformLocation(axisProgram, "color");

    return { axisProgram, axisResolution, axisColor };
  }
}
