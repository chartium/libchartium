export const wasmUrl = import.meta.resolve("/dist/wasm/libchartium_bg.wasm");
import init, * as lib from "../../../dist/wasm/libchartium.js";

export { init, lib };
