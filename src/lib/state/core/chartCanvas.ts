import { derived, mut, type Signal } from "@mod.js/signals";
import type { Size } from "../../types.js";

export interface ChartCanvasProps {
  canvas$: Signal<HTMLCanvasElement | undefined>;
}

export interface ChartCanvas {
  offscreenCanvas$: Signal<OffscreenCanvas | undefined>;
  canvasLogicalSize$: Signal<Size | undefined>;
}

export const chartCanvas$ = ({ canvas$ }: ChartCanvasProps): ChartCanvas => {
  const canvasLogicalSize$ = canvas$.flatMap((canvas, { defer }) => {
    if (!canvas) return;

    const currSize = (): Size | undefined => {
      const { width, height } = canvas.getBoundingClientRect();

      return { width, height };
    };

    const size = mut<Size | undefined>(currSize());
    const obs = new ResizeObserver(() => size.set(currSize()));
    obs.observe(canvas);
    defer(() => obs.disconnect());

    return size;
  });

  const offscreenCanvasCache = new WeakMap<
    HTMLCanvasElement,
    OffscreenCanvas
  >();
  const offscreenCanvas$ = derived(($) => {
    const onscreen = $(canvas$);
    if (!onscreen) return undefined;

    const offscreen = offscreenCanvasCache.get(onscreen);
    if (offscreen) return offscreen;

    try {
      const offscreen = onscreen.transferControlToOffscreen();
      offscreenCanvasCache.set(onscreen, offscreen);
      return offscreen;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }).skipEqual();

  return { offscreenCanvas$, canvasLogicalSize$ };
};
