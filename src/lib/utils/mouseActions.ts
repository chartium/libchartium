/** this file handles bunch of mouse gesture events you can use as svelte actions */

import type { ActionReturn } from "svelte/action";
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
    public threshold: number = 5,
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
  params: MouseDragCallbacks & { button: MouseButtons; threshold?: number },
) => {
  let status: DragStatus | undefined = undefined;

  const onStart = (event: MouseEvent) => {
    if (!elem.contains(event.target as Node)) return;
    if (event.buttons !== params.button) return;

    const elemRect = elem.getBoundingClientRect();
    const point = {
      x: event.clientX - elemRect.x,
      y: event.clientY - elemRect.y,
    };
    status = new DragStatus(
      point,
      { ...point },
      { width: elem.clientWidth, height: elem.clientHeight },
      params.threshold ?? 5,
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

    const elemRect = elem.getBoundingClientRect();
    status.to.x = event.clientX - elemRect.x;
    status.to.y = event.clientY - elemRect.y;

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

export function mouseClick(
  node: HTMLElement,
  params: { callback: (event: MouseEvent) => void } & {
    button: MouseButtons;
    threshold?: number;
  },
) {
  let init: Point | undefined;

  const handleMouseDown = (event: MouseEvent) => {
    if (event.buttons !== params.button) return;

    init = { x: event.clientX, y: event.clientY };
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!init) return;

    // Check distance and call callback
    const deltaX = event.clientX - init.x;
    const deltaY = event.clientY - init.y;
    const threshold = 5;

    if (deltaX * deltaX + deltaY * deltaY < threshold * threshold)
      params.callback(event);

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
  callback: (event: MouseEvent) => void,
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
  callback: (event: MouseEvent) => void,
) {
  document.addEventListener("mousemove", callback, true);

  return {
    destroy() {
      document.removeEventListener("mousemove", callback, true);
    },
  };
}

export type RelativeMousemoveEvent = {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
};

/**
 * Action that adds three events to the node:
 *  * relativeMousemove
 *  * relativeMousein
 *  * relativeMouseout
 *
 * all with detail of type RelativeMousemoveEvent. Similar usage to mousemove, mouseout
 * and mousein, however they also get triggered by pure scrolling
 */
export function relativeMousemove(node: HTMLElement): ActionReturn<
  void,
  {
    "on:relativeMousemove"?: (e: CustomEvent<RelativeMousemoveEvent>) => void;
    "on:relativeMousein"?: (e: CustomEvent<RelativeMousemoveEvent>) => void;
    "on:relativeMouseout"?: (e: CustomEvent<RelativeMousemoveEvent>) => void;
  }
> {
  const abort = new AbortController();

  const getOffsets = (
    clients: { clientX: number; clientY: number },
    node: HTMLElement,
  ) => {
    const rect = node.getBoundingClientRect();
    return {
      offsetX: clients.clientX - rect.left,
      offsetY: clients.clientY - rect.top,
    };
  };

  let lastClients: { clientX: number; clientY: number } | undefined;
  let lastTimeWeWereIn = false;
  const handleEvent = (e: Event) => {
    if (e instanceof MouseEvent)
      lastClients = { clientX: e.clientX, clientY: e.clientY };
    if (lastClients === undefined) return;
    const { clientX, clientY } = lastClients;
    const elements = document.elementsFromPoint(clientX, clientY);
    const { offsetX, offsetY } = getOffsets({ clientX, clientY }, node);
    const detail: RelativeMousemoveEvent = {
      clientX,
      clientY,
      offsetX,
      offsetY,
    };

    const currentlyWeAreIn = elements.includes(node);
    if (!currentlyWeAreIn) {
      if (lastTimeWeWereIn) {
        node.dispatchEvent(new CustomEvent("relativeMouseout", { detail }));
      }
      lastTimeWeWereIn = false;
      return;
    }

    if (!lastTimeWeWereIn) {
      node.dispatchEvent(new CustomEvent("relativeMousein", { detail }));
    }
    lastTimeWeWereIn = true;
    node.dispatchEvent(new CustomEvent("relativeMousemove", { detail }));
  };

  document.addEventListener("mousemove", handleEvent, {
    passive: true,
    signal: abort.signal,
  });

  document.addEventListener("scroll", handleEvent, {
    capture: true,
    passive: true,
    signal: abort.signal,
  });

  return { destroy: () => abort.abort() };
}

/**
 * Action that registers events similar to on:click and on:dblclick but if doubleclick happens the single clicks don't get triggered
 * @param node the node to attach the action to
 * @param callbacks the callbacks to call on single and double click
 * @param delayMS the delay in milliseconds to wait for the second click
 */
export function singleOrDoubleclick(
  node: HTMLElement,
  callbacks: {
    single: (event: MouseEvent) => void;
    double: (event: MouseEvent) => void;
  },
  delayMS: number = 300,
) {
  const handleFirstClick = (event: MouseEvent) => {
    let secondClickHappened = false;
    node.removeEventListener("click", handleFirstClick, true);

    window.addEventListener(
      "click",
      () => {
        secondClickHappened = true;
      },
      true,
    );
    setTimeout(() => {
      window.removeEventListener(
        "click",
        () => {
          secondClickHappened = true;
        },
        true,
      );
      node.addEventListener("click", handleFirstClick, true);

      if (secondClickHappened) callbacks.double(event);
      else callbacks.single(event);
    }, delayMS);
  };

  node.addEventListener("click", handleFirstClick, true);

  return {
    destroy() {
      node.removeEventListener("click", handleFirstClick, true);
    },
  };
}
