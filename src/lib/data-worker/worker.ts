import { ChartiumController } from "./controller.ts";
import { exportControllerFromWorker } from "./export.ts";

ChartiumController.instantiateInThisThread().then((controller) =>
  exportControllerFromWorker(controller)
);
