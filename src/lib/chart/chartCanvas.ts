import { mut, type Signal } from "@mod.js/signals";
import type { Size } from "../types.js";

export interface ChartCanvasProps {
  canvas$: Signal<HTMLCanvasElement | undefined>;
}

export interface ChartCanvas {
  offscreenCanvas$: Signal<OffscreenCanvas | undefined>;
  canvasSize$: Signal<Size | undefined>;
}

export const chartCanvas$ = ({ canvas$ }: ChartCanvasProps): ChartCanvas => {
  const canvasSize$ = canvas$.flatMap((canvas, { defer }) => {
    if (!canvas) return;

    const currSize = (): Size | undefined => {
      const { width, height } = canvas.getBoundingClientRect();
      return {
        width: width * devicePixelRatio,
        height: height * devicePixelRatio,
      };
    };

    const size = mut<Size | undefined>(currSize());
    const obs = new ResizeObserver(() => size.set(currSize()));
    obs.observe(canvas);
    defer(() => obs.disconnect());

    return size;
  });

  const offscreenCanvas$ = canvas$
    .skipEqual()
    .map((c) => c?.transferControlToOffscreen());

  return { offscreenCanvas$, canvasSize$ };
};
