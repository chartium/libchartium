# 📈 libchartium 🚀

The documentation is getting ready, please check back soon!

## Installation
```sh
npm add libchartium unitlib fraction.js
```

## Example

```svelte
<script lang="ts">
  import { ChartiumController, ChartComponent as Chart } from 'libchartium';
  import wasmUrl from 'libchartium/wasm?url';

  const controller = ChartiumController.instantiateInThisThread({ wasmUrl });

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize,
  );

  const ys = Array.from({ length: 100 }, (_, idx) => ({
    id: `trace_${idx}`,
    data: Float32Array.from(
      xs.map((x) => 100 + 100 * Math.sin((x / to) * 2 * Math.PI + idx)),
    ),
  }));

  const traces = controller.addFromColumnarArrayBuffers({
    x: {
      type: "f32",
      data: Float32Array.from(xs),
    },
    y: {
      type: "f32",
      columns: ys,
    },
    style: {
      "*": { width: 2 },
      sin: { color: "red" },
    },
  });
</script>
<Chart {controller} {traces} />
```

