import { ChartiumController } from "./controller.ts";
import { exportControllerFromWorker } from "./comlink.ts";

exportControllerFromWorker(ChartiumController.instantiateInThisThread());
