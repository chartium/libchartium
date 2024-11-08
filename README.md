# 📈 libchartium 🚀

The documentation is getting ready, please check back soon!

## Installation

```sh
npm add libchartium unitlib fraction.js
# or
pnpm add libchartium unitlib fraction.js
# or
bun add libchartium unitlib fraction.js
```

You will also need to make sure that your bundler can import WebAssembly as ES
modules according to
[the ESM integration proposal](https://github.com/WebAssembly/esm-integration).
For Vite that means you need to add
[`vite-plugin-wasm`](https://github.com/Menci/vite-plugin-wasm#readme), for
Rollup it's
[`@rollup/plugin-wasm`](https://github.com/rollup/plugins/tree/master/packages/wasm).
In Webpack you'll have to allow
[`asyncWebAssembly`](https://webpack.js.org/configuration/experiments/) in the
config.

## Example

```svelte
<script lang="ts">
  import { TraceList, ChartComponent as Chart, NumericDateRepresentation } from 'libchartium';

  const from = +new Date();
	const numSteps = 10_000;
	const stepSize = 100_000;
	const to = from + numSteps * stepSize;

  const xs = Array.from(
    { length: numSteps },
    (_, index) => from + index * stepSize,
  );

  const ys = Array.from({ length: 100 }, (_, idx) => ({
    id: `trace_${idx}`,
    data: Float32Array.from(
      xs.map((x) => 100 + 100 * Math.sin((x / (from - to)) * 2 * Math.PI + idx)),
    ),
  }));

  const traces = TraceList.fromColumns({
    x: {
      type: "f32",
      data: Float32Array.from(xs),
			unit: NumericDateRepresentation.EpochMilliseconds()
    },
    y: {
      type: "f32",
      columns: ys,
    },
    style: {
      "*": { "line-width": 2 },
      trace_0: { color: "red" },
    },
  });
</script>
<Chart {controller} {traces} />
```
