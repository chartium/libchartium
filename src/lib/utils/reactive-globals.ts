import { Defer, mut } from "@typek/signalhead";

const mutDevicePixelRatio$ = mut(globalThis.devicePixelRatio ?? 1, {
  onStart({ defer: onStop }) {
    const { defer, cleanup } = Defer.create();
    onStop(cleanup);

    const listenToUpdates = () => {
      globalThis
        .matchMedia?.(`(resolution: ${globalThis.devicePixelRatio}dppx)`)
        .addEventListener(
          "change",
          () => {
            mutDevicePixelRatio$.set(globalThis.devicePixelRatio);
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
