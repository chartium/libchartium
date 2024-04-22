import init, * as lib from "../../../dist/wasm/libchartium.js";
import wasmUrl from "libchartium/wasm?url";

const initOutput = await init(wasmUrl);
lib.set_panic_hook();

export const wasmMemory = initOutput.memory;
export { lib };
