import type { ActionReturn } from "svelte/action";

/** Run a callback on mount and on resize detected by a ResizeObserver */
export const observeSize = <T extends HTMLElement>(
  element: T,
  callback: (element: T) => void,
) => {
  const resizeObserver = new ResizeObserver(() => {
    callback(element);
  });

  resizeObserver.observe(element);

  callback(element);

  return {
    destroy: () => resizeObserver.disconnect(),
  } satisfies ActionReturn;
};

/** Run a callback on mount and on resize detected by a ResizeObserver.
 * This is a convenience wrapper over {@link observeSize} to report client size directly.
 */
export const observeClientSize = (
  element: HTMLElement,
  callback: (clientSize: [number, number]) => void,
) => {
  return observeSize(element, (element) => {
    callback([element.clientWidth, element.clientHeight]);
  });
};

/** Run a callback on mount and on resize detected by a ResizeObserver.
 * This is a convenience wrapper over {@link observeSize} to report offset size directly.
 */
export const observeOffsetSize = (
  element: HTMLElement,
  callback: (clientSize: [number, number]) => void,
) => {
  return observeSize(element, (element) => {
    callback([element.offsetWidth, element.offsetHeight]);
  });
};

/** Update the dimensions of the coordinate space of a canvas according to its CSS dimensions */
export const scaleCanvas = (
  element: HTMLCanvasElement,
  callback?: (size: [width: number, height: number]) => void,
) => {
  return observeClientSize(element, (size) => {
    size.forEach((v, i) => (size[i] = Math.trunc(v)));

    element.width = size[0] * window.devicePixelRatio;
    element.height = size[1] * window.devicePixelRatio;

    if (callback) callback(size);
  });
};
