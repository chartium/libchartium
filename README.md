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

## Troubleshooting
If loading the library fails with `Uncaught CompileError: WebAssembly.instantiate()`, it is probably because your bundler cannot find the WebAssembly binary. The wasm file is exported as `libchartium/wasm`, and in our code we initialize it as follows:
```ts
import wasmUrl from "libchartium/wasm?url";
await init(wasmUrl);
```
If your bundler supports it, try to [alias](https://vitejs.dev/config/shared-options#resolve-alias) the import `libchartium/wasm?url` to a TS/JS file containing the following:
```ts
const wasmUrl = "/actual/path/to/libchartium.wasm";
export default wasmUrl;
```

