import { expose, wrap, transfer, type Remote } from "comlink";
import type { ChartiumController } from "./controller.js";
import { asMap } from "../utils/object.js";

export function exportControllerFromWorker(
  controller: ChartiumController
): void {
  expose(controller);
}

export function importControllerFromWorker(
  w: Worker | { new (): Worker } | string
): Remote<ChartiumController> {
  w =
    typeof w === "function"
      ? new w()
      : typeof w === "string"
      ? new Worker(w)
      : w;

  const remote = wrap<ChartiumController>(w);

  const mask = asMap({
    createRenderer(presentCanvas: OffscreenCanvas) {
      return remote.createRenderer(transfer(presentCanvas, [presentCanvas]));
    },

    // TODO transfer for data loading
  });

  return new Proxy(remote, {
    get(target, prop) {
      if (mask.has(prop)) return mask.get(prop);
      return (target as any)[prop];
    },
  });
}
