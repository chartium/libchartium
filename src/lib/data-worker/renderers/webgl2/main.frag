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
  if(shouldBeDrawn) {
    gl_FragColor = color;
  } else {
    discard;
  }
}
