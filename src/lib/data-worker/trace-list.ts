import type { lib } from "./wasm";

export class TraceList {
  #traceHandles: Uint32Array;
  #bundles: lib.BoxedBundle;
}
