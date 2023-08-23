import type { Action } from "svelte/action";
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
    if (init) {
      const deltaX = event.clientX - init.x;
      const deltaY = event.clientY - init.y;
      const threshold = params.threshold ?? 5;

      if (deltaX * deltaX + deltaY * deltaY < threshold * threshold) return;

      params.move(event);
    }
  };

  const onEnd = (event: MouseEvent) => {
    if (init) {
      params.end(event);
    }

    init = undefined;
  };

  elem.addEventListener("mousedown", onStart);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);

  return {
    destroy() {
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("mousemove", onMove);
      elem.removeEventListener("mousedown", onStart);
    },
  };
};

export function rightMouseClick(
  node: HTMLElement,
  callback: (event: MouseEvent) => void
) {
  // just like dragging but triggers on mouseup only if the mouse didn't move
  let startX: number, startY: number;
  let isDragging = false;

  const handleMouseDown = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Right) return;
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Right) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isDragging = true;
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!isDragging) {
      callback(event);
    }

    node.removeEventListener("mousemove", handleMouseMove);
    node.removeEventListener("mouseup", handleMouseUp);
  };

  node.addEventListener("mousedown", handleMouseDown);

  return {
    destroy() {
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("mouseup", handleMouseUp);
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
