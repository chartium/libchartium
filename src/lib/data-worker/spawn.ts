export const WORKER_URL = new URL(
  "../../../dist/lib/data-worker/worker.js",
  import.meta.url
).href;

import { importControllerFromWorker } from "./comlink.js";

export function spawnChartiumWorker() {
  return importControllerFromWorker(WORKER_URL);
}
