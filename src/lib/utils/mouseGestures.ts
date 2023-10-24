/** this file handles bunch of mouse gesture events you can use as svelte actions */

import type { Point, Shift, Size, Zoom } from "../types.js";

export interface MouseDragCallbacks {
  start: (event: MouseEvent) => void;
  move: (event: MouseEvent, status: DragStatus) => void;
  end: (event: MouseEvent, status: DragStatus) => void;
}

class DragStatus {
  constructor(
    public from: Point,
    public to: Point,
    public extents: Size,
    public threshold: number = 5
  ) {}

  public get absoluteShift(): Shift {
    const result: Shift = {
      origin: { ...this.from },
    };

    for (const key of ["x", "y"] as ("x" | "y")[]) {
      const delta = this.to[key] - this.from[key];
      if (Math.abs(delta) > this.threshold)
        result[`d${key}`] = delta * (key === "y" ? -1 : 1);
    }

    return result;
  }

  public get relativeShift(): Shift {
    const abs = this.absoluteShift;

    const result: Shift = {
      origin: {
        x: this.from.x / this.extents.width,
        y: 1 - this.from.y / this.extents.height,
      },
    };

    for (const [key, size] of [
      ["dx", this.extents.width],
      ["dy", this.extents.height],
    ] as ["dx" | "dy", number][]) {
      if (abs[key]) result[key] = abs[key]! / size;
    }

    return result;
  }

  public get relativeZoom(): Zoom {
    const shift = this.relativeShift;

    const dx = shift.dx ?? 0;
    const dy = shift.dy ?? 0;

    const [xFrom, xTo] = [shift.origin!.x, shift.origin!.x + dx].sort();
    const [yFrom, yTo] = [shift.origin!.y, shift.origin!.y + dy].sort();

    return {
      x: { from: xFrom, to: xTo },
      y: { from: yFrom, to: yTo },
    };
  }

  public beyondThreshold(axes: "x" | "y" | "any" | "both"): boolean {
    const dx = Math.abs(this.to.x - this.from.x);
    const dy = Math.abs(this.to.y - this.from.y);

    if (axes === "x") return dx > this.threshold;
    if (axes === "y") return dy > this.threshold;
    if (axes === "any") return dx > this.threshold || dy > this.threshold;
    return dx > this.threshold && dy > this.threshold;
  }
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
  let status: DragStatus | undefined = undefined;

  const onStart = (event: MouseEvent) => {
    if (event.target !== elem) return;
    if (event.buttons !== params.button) return;

    const point = { x: event.offsetX, y: event.offsetY };
    status = new DragStatus(
      point,
      { ...point },
      { width: elem.clientWidth, height: elem.clientHeight },
      params.threshold ?? 5
    );

    params.start(event);
  };

  const onMove = (event: MouseEvent) => {
    if (!status) return;
    event.preventDefault();

    status.to.x += event.movementX;
    status.to.y += event.movementY;

    params.move(event, status);
  };

  const onEnd = (event: MouseEvent) => {
    if (!status) return;

    status.extents.width = elem.clientWidth;
    status.extents.height = elem.clientHeight;
    status.to.x = event.offsetX;
    status.to.y = event.offsetY;

    params.end(event, status);
    status = undefined;
  };

  elem.addEventListener("mousedown", onStart);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onEnd, true);

  return {
    destroy() {
      window.removeEventListener("mouseup", onEnd, true);
      window.removeEventListener("mousemove", onMove, true);
      elem.removeEventListener("mousedown", onStart);
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
  window.addEventListener("mouseup", handleMouseUp, true);

  return {
    destroy() {
      node.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
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

  window.addEventListener("click", handleClick, true);

  return {
    destroy() {
      window.removeEventListener("click", handleClick, true);
    },
  };
}

export function globalMouseMove(
  node: HTMLElement,
  callback: (event: MouseEvent) => void
) {
  document.addEventListener("mousemove", callback, true);

  return {
    destroy() {
      document.removeEventListener("mousemove", callback, true);
    },
  };
}
