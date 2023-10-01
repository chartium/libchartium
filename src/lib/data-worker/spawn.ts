import Worker from "./worker.js?worker";
import { importControllerFromWorker } from "./comlink.js";

export function spawnChartiumWorker() {
  return importControllerFromWorker(Worker);
}
