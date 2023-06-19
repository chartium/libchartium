import { expose, wrap, type Remote } from "comlink";
import Worker from "./worker.ts?worker";
import { ChartiumController } from "./controller.ts";

export function exportControllerFromWorker(
  controller: ChartiumController
): void {
  expose(controller);
}

export function importControllerFromWorker(
  w: Worker | { new (): Worker }
): Remote<ChartiumController> {
  w = typeof w === "function" ? new w() : w;
  return wrap<ChartiumController>(w);
}

export function spawnChartiumWorker() {
  return importControllerFromWorker(Worker);
}
