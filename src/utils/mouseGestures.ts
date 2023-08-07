/** this file handles bunch of mouse gesture events you can use as svelte actions */

export interface MouseDragCallbacks {
    start: (event: MouseEvent) => void;
    move: (event: MouseEvent) => void;
    end: (event: MouseEvent) => void;
}

/** adds a left mouse drag event, which requires a trifecta of callbacks bundled in MouseDragOptions */
export function leftMouseDrag(node: HTMLElement, callbacks: MouseDragCallbacks) {
    let startX : number, startY : number;
    let isDragging = false;

    const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return; // only left click
        startX = event.clientX;
        startY = event.clientY;
        isDragging = false;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (event.button !== 0) return; // only left click
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
        if (event.button !== 0) return; // only left click
        if (isDragging) {
            callbacks.end(event);
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleMouseDown);

    return {
        destroy() {
            document.removeEventListener('mousedown', handleMouseDown);
        },
    };
}

export function rightMouseDrag(node: HTMLElement, callbacks: MouseDragCallbacks) {
    let startX: number, startY: number;
    let isDragging = false;

    const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 2) return; // only right click
        startX = event.clientX;
        startY = event.clientY;
        isDragging = false;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (event.button !== 2) return; // only right click
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
        if (event.button !== 2) return; // only right click
        if (isDragging) {
            callbacks.end(event);
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleMouseDown);

    return {
        destroy() {
            document.removeEventListener('mousedown', handleMouseDown);
        },
    };
}

