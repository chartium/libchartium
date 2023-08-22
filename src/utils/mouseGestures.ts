/** this file handles bunch of mouse gesture events you can use as svelte actions */

export interface MouseDragCallbacks {
  start: (event: MouseEvent) => void;
  move: (event: MouseEvent) => void;
  end: (event: MouseEvent) => void;
}

enum MouseButtons {
  Left = 1,
  Middle = 4,
  Right = 2,
}

/** adds a left mouse drag event, which requires a trifecta of callbacks bundled in MouseDragOptions */
export function leftMouseDrag(
  node: HTMLElement,
  callbacks: MouseDragCallbacks
) {
  let startX: number, startY: number;
  let isDragging = false;

  const handleMouseDown = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Left) return;
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    node.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Left) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isDragging = true;
      callbacks.start(event);
    }

    if (isDragging) {
      callbacks.move(event);
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (isDragging) {
      callbacks.end(event);
    }

    node.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  node.addEventListener("mousedown", handleMouseDown);

  return {
    destroy() {
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    },
  };
}

export function rightMouseDrag(
  node: HTMLElement,
  callbacks: MouseDragCallbacks
) {
  let startX: number, startY: number;
  let isDragging = false;

  const handleMouseDown = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Right) return;
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    node.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (event.buttons !== MouseButtons.Right) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isDragging = true;
      callbacks.start(event);
    }

    if (isDragging) {
      callbacks.move(event);
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (isDragging) {
      callbacks.end(event);
    }

    node.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  node.addEventListener("mousedown", handleMouseDown);

  return {
    destroy() {
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    },
  };
}

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
