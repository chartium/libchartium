# 📈 libchartium 🚀

The documentation is getting ready, please check back soon!

## Installation
```sh
npm add libchartium unitlib fraction.js
```
You will also need to make sure that your bundler can import WebAssembly as ES modules according to [the ESM integration proposal](https://github.com/WebAssembly/esm-integration). For Vite that means you need to add [`vite-plugin-wasm`](https://github.com/Menci/vite-plugin-wasm#readme), for Rollup it's [`@rollup/plugin-wasm`](https://github.com/rollup/plugins/tree/master/packages/wasm). In Webpack you'll have to allow [`asyncWebAssembly`](https://webpack.js.org/configuration/experiments/) in the config.

## Example

```svelte
<script lang="ts">
  import { ChartiumController, ChartComponent as Chart } from 'libchartium';
  const controller = new ChartiumController();

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
