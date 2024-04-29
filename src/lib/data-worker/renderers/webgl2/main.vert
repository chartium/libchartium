attribute vec2 aVertexPosition;
attribute float aLengthAlong;
varying float vLengthAlong;

uniform vec2 transform;
uniform vec2 origin;
uniform vec2 size;

uniform vec2 csoffset;

void main() {
  gl_Position = vec4(csoffset + vec2(-1, -1) + vec2(2, 2) * (aVertexPosition * vec2(1, transform.x) + vec2(0, transform.y) - origin) / size, 0, 1);
  gl_PointSize = 8.0;
  vLengthAlong = aLengthAlong;
}
