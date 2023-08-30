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
