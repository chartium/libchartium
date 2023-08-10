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
export function leftMouseDrag(node: HTMLElement, callbacks: MouseDragCallbacks) {
    let startX : number, startY : number;
    let isDragging = false;

    const handleMouseDown = (event: MouseEvent) => {
        if (event.buttons !== MouseButtons.Left) return;
        startX = event.clientX;
        startY = event.clientY;
        isDragging = false;
        node.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
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

        node.removeEventListener('mousemove', handleMouseMove);
        node.removeEventListener('mouseup', handleMouseUp);
    };

    node.addEventListener('mousedown', handleMouseDown);

    return {
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown);
            node.removeEventListener('mousemove', handleMouseMove);
            node.removeEventListener('mouseup', handleMouseUp);
        },
    };
}

export function rightMouseDrag(node: HTMLElement, callbacks: MouseDragCallbacks) {
    let startX: number, startY: number;
    let isDragging = false;

    const handleMouseDown = (event: MouseEvent) => {
        if (event.buttons !== MouseButtons.Right) return;
        startX = event.clientX;
        startY = event.clientY;
        isDragging = false;
        node.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
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

        node.removeEventListener('mousemove', handleMouseMove);
        node.removeEventListener('mouseup', handleMouseUp);
    };

    node.addEventListener('mousedown', handleMouseDown);

    return {
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown);
            node.removeEventListener('mousemove', handleMouseMove);
            node.removeEventListener('mouseup', handleMouseUp);
        },
    };
}