import Worker from "./worker.ts?worker";
import { importControllerFromWorker } from "./comlink.ts";

export function spawnChartiumWorker() {
  return importControllerFromWorker(Worker);
}
