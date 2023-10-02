export const wasmUrl = new URL(
  "../../../dist/wasm/libchartium_bg.wasm",
  import.meta.url
).href;

import init, * as lib from "../../../dist/wasm/libchartium.js";

export { init, lib };
