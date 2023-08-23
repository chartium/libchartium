import type { Point } from "../lib/types";

/** this file handles bunch of mouse gesture events you can use as svelte actions */

export interface MouseDragCallbacks {
  start: (event: MouseEvent) => void;
  move: (event: MouseEvent) => void;
  end: (event: MouseEvent) => void;
}

export enum MouseButtons {
  Left = 1,
  Middle = 4,
  Right = 2,
}

export const mouseDrag = (
  elem: HTMLElement,
  params: MouseDragCallbacks & { button: MouseButtons; threshold?: number }
) => {
  let init: Point | undefined = undefined;

  const onStart = (event: MouseEvent) => {
    if (event.buttons !== params.button) return;

    init = { x: event.clientX, y: event.clientY };
    params.start(event);
  };

  const onMove = (event: MouseEvent) => {
    if (!init) return;

    const deltaX = event.clientX - init.x;
    const deltaY = event.clientY - init.y;
    const threshold = params.threshold ?? 5;

    if (deltaX * deltaX + deltaY * deltaY < threshold * threshold) return;

    params.move(event);
  };

  const onEnd = (event: MouseEvent) => {
    if (!init) return;

    params.end(event);
    init = undefined;
  };

  elem.addEventListener("mousedown", onStart, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onEnd, true);

  return {
    destroy() {
      window.removeEventListener("mouseup", onEnd, true);
      window.removeEventListener("mousemove", onMove, true);
      elem.removeEventListener("mousedown", onStart, true);
    },
  };
};

export function rightMouseClick(
  node: HTMLElement,
  callback: (event: MouseEvent) => void
) {
  let init: Point | undefined;

  const handleMouseDown = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Right) return;

    init = { x: event.clientX, y: event.clientY };
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!init) return;

    // Check distance and call callback
    const deltaX = event.clientX - init.x;
    const deltaY = event.clientY - init.y;
    const threshold = 5;

    if (deltaX * deltaX + deltaY * deltaY < threshold * threshold)
      callback(event);

    init = undefined;
  };

  node.addEventListener("mousedown", handleMouseDown, true);
  node.addEventListener("mouseup", handleMouseUp, true);

  return {
    destroy() {
      node.removeEventListener("mouseup", handleMouseUp, true);
      node.removeEventListener("mousedown", handleMouseDown, true);
    },
  };
}

export function clickOutside(
  node: HTMLElement,
  callback: (event: MouseEvent) => void
) {
  const handleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node)) return;
    if (!node.contains(event.target)) {
      callback(event);
    }
  };

  document.addEventListener("click", handleClick, true);

  return {
    destroy() {
      document.removeEventListener("click", handleClick, true);
    },
  };
}
