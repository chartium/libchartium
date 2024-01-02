import type { ActionReturn } from "svelte/action";

export const observeResize = (
  element: HTMLElement,
  callback: (size: [width: number, height: number]) => void
) => {
  const resizeObserver = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    callback([width, height]);
  });

  resizeObserver.observe(element);

  return {
    destroy: () => resizeObserver.disconnect(),
  } satisfies ActionReturn;
};

/** Update the dimensions of the coordinate space of a canvas according to its CSS dimensions */
export const scaleCanvas = (
  element: HTMLCanvasElement,
  callback?: (size: [width: number, height: number]) => void
) => {
  return observeResize(element, (size) => {
    size.forEach((v, i) => (size[i] = Math.trunc(v)));

    element.width = size[0] * window.devicePixelRatio;
    element.height = size[1] * window.devicePixelRatio;

    if (callback) callback(size);
  });
};
