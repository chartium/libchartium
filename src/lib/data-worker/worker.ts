import { ChartiumController } from "./controller.ts";
import { exportControllerFromWorker } from "./spawn.ts";

const controller = await ChartiumController.instantiateInThisThread();
exportControllerFromWorker(controller);
