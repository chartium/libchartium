export const WORKER_URL = import.meta.resolve(
  "/dist/lib/data-worker/worker.js"
);
import { importControllerFromWorker } from "./comlink.js";

export function spawnChartiumWorker() {
  return importControllerFromWorker(WORKER_URL);
}
