import type { lib } from "./wasm";

export class TraceList {
  #traceHandles: Uint32Array;
  #batches: lib.Batch;
}
