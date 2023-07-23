import { expose, wrap, transfer, type Remote } from "comlink";
import type { ChartiumController } from "./controller.ts";

export function exportControllerFromWorker(
  controller: ChartiumController
): void {
  expose(controller);
}

export function importControllerFromWorker(
  w: Worker | { new (): Worker }
): Remote<ChartiumController> {
  w = typeof w === "function" ? new w() : w;
  const remote = wrap<ChartiumController>(w);

  const masked = {
    createRenderer(presentCanvas: OffscreenCanvas) {
      return remote.createRenderer(transfer(presentCanvas, [presentCanvas]));
    },
  };

  return new Proxy(remote, {
    get(target, prop) {
      if (prop in masked) return (masked as any)[prop];
      return (target as any)[prop];
    },
  });
}
