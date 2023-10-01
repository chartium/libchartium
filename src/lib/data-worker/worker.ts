import { ChartiumController } from "./controller.js";
import { exportControllerFromWorker } from "./comlink.js";

exportControllerFromWorker(ChartiumController.instantiateInThisThread());
