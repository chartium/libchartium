import { expose, wrap, type Remote } from "comlink";
import { ChartiumController } from "./controller.ts";

export function exportControllerFromWorker(
  controller: ChartiumController
): void {
  expose(controller);
}
