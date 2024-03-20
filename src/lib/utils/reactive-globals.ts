import { Defer, mut } from "@mod.js/signals";

const mutDevicePixelRatio$ = mut(window.devicePixelRatio, {
  onStart({ defer: onStop }) {
    const { defer, cleanup } = Defer.create();
    onStop(cleanup);

    const listenToUpdates = () => {
      matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      ).addEventListener(
        "change",
        () => {
          mutDevicePixelRatio$.set(window.devicePixelRatio);
          cleanup();
          listenToUpdates();
        },
        { once: true, signal: defer.toAbortSignal() },
      );
    };
    listenToUpdates();
  },
});

export const devicePixelRatio$ = mutDevicePixelRatio$.toReadonly();
