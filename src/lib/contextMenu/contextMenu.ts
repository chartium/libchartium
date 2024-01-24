export interface ContextLeaf<T> {
  type: "leaf";
  /** Content of the menu item, usually text, to be displayed */
  content: T;
  /** Short description of this item's functionality. If kept undefined
   * will just reuse the content, which may be problematic if T isn't a type that has a reasonable print */
  ariaLabel?: string;
  /** Callback to be called upon clicking this option */
  callback?: () => void;
}
export interface ContextBranch<T> {
  type: "branch";
  /** Content of the menu item, usually text, to be displayed */
  content: T;
  /** Short description of this item's functionality. If kept undefined
   * will just reuse the content, which may be problematic if T isn't a type that has a reasonable print */
  ariaLabel?: string;
  /** The submenu */
  children: ContextItem<T>[];
}
export interface ContextSeparator {
  type: "separator";
}
/** Type for the context menu
 * context menu is just a list of ContextItems where each can be
 * a leaf with content and callback,
 * a branch, i.e. a submenu,
 * or a separator which is just a line
 */
export type ContextItem<T> =
  | ContextLeaf<T>
  | ContextBranch<T>
  | ContextSeparator;

export interface Point {
  x: number;
  y: number;
}

/** returns opening position at the point positionRelativeToPage or if overflow reflect around the opening point */
export function openPositionNextToPoint(
  positionRelativeToPage: Point,
  menuHeight: number,
  menuWidth: number,
): Point {
  const { x, y } = positionRelativeToPage;
  const { innerWidth, innerHeight } = window;
  const positionOfRightMenuBoundary = x + menuWidth + 3;
  const positionOfBottomMenuBoundary = y + menuHeight + 3;
  const rightOverflow = positionOfRightMenuBoundary - innerWidth;
  const bottomOverflow = positionOfBottomMenuBoundary - innerHeight;
  return {
    x: rightOverflow > 0 ? x - menuWidth : x,
    y: bottomOverflow > 0 ? y - menuHeight : y,
  };
}

/** returns opening position next to a DOMRect in such a way that the opened menu will fit on the page
 * by default opens to the right of the rect, if there is not enough space, opens to the left
 */
export function openPositionNextToRect(
  rect: DOMRect,
  menuHeight: number,
  menuWidth: number,
): Point {
  const x = rect.right + window.scrollX;
  const y = rect.top + window.scrollY;
  const { innerWidth, innerHeight, scrollX, scrollY } = window;
  const positionOfRightMenuBoundary = x + menuWidth + 3;
  const positionOfBottomMenuBoundary = y + menuHeight + 3;
  const rightOverflow =
    positionOfRightMenuBoundary - innerWidth - window.scrollX;
  const bottomOverflow =
    positionOfBottomMenuBoundary - innerHeight - window.scrollY;
  return {
    x:
      rightOverflow > 0
        ? x - rect.width - menuWidth - scrollX - 3
        : x - scrollX,
    y: bottomOverflow > 0 ? y - bottomOverflow - scrollY : y - scrollY,
  };
}

/** svelte action for adding a click outside event on an element */
export function mouseDownOutside(
  node: HTMLElement,
  callback: (event: MouseEvent) => void,
) {
  const handleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node)) return;
    if (!node.contains(event.target)) {
      callback(event);
    }
  };

  document.addEventListener("mousedown", handleClick, true);

  return {
    destroy() {
      document.removeEventListener("mousedown", handleClick, true);
    },
  };
}

/** svelte action for keydown that doesn't require focus on the div component listening */
export function genericKeydown(
  node: HTMLElement,
  callback: (event: KeyboardEvent) => void,
) {
  const handleKeydown = (event: KeyboardEvent) => {
    callback(event);
  };

  document.addEventListener("keydown", handleKeydown, true);

  return {
    destroy() {
      document.removeEventListener("keydown", handleKeydown, true);
    },
  };
}
