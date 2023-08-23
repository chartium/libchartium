export interface ContextLeaf {
  type: "leaf";
  /** Content of the menu item, usually text, to be displayed */
  content: any;
  /** Callback to be called upon clicking this option */
  callback: () => void;
}
export interface ContextBranch {
  type: "branch";
  /** Content of the menu item, usually text, to be displayed */
  content: any;
  /** The submenu */
  children: ContextItem[];
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
export type ContextItem = ContextLeaf | ContextBranch | ContextSeparator;

export interface Point {
  x: number;
  y: number;
}

/** returns opening position at the point positionRelativeToPage or if overflow reflect around the opening point */
export function openPositionNextToPoint(
  positionRelativeToPage: Point,
  menuHeight: number,
  menuWidth: number
): Point {
  const { x, y } = positionRelativeToPage;
  const { innerWidth, innerHeight } = window;
  const positionOfRightMenuBoundary = x + menuWidth + 3;
  const positionOfBottomMenuBoundary = y + menuHeight + 3;
  const rightOverflow = positionOfRightMenuBoundary - innerWidth;
  const bottomOverflow = positionOfBottomMenuBoundary - innerHeight;
  return {
    x: rightOverflow > 0 ? x - rightOverflow : x,
    y: bottomOverflow > 0 ? y - bottomOverflow : y,
  };
}

/** returns opening position next to a DOMRect in such a way that the opened menu will fit on the page
 * by default opens to the right of the rect, if there is not enough space, opens to the left
 */
export function openPositionNextToRect(rect: DOMRect, menuHeight: number, menuWidth: number): Point {
  const x = rect.right + window.scrollX;
  const y = rect.top + window.scrollY;
  const { innerWidth, innerHeight } = window;
  const positionOfRightMenuBoundary = x + menuWidth + 3;
  const positionOfBottomMenuBoundary = y + menuHeight + 3;
  const rightOverflow = positionOfRightMenuBoundary - innerWidth;
  const bottomOverflow = positionOfBottomMenuBoundary - innerHeight;
  return {
    x: rightOverflow > 0 ? x - rect.width - menuWidth - 3 : x,
    y: bottomOverflow > 0 ? y - bottomOverflow : y,
  };
}

/** svelte action for adding a click outside event on an element */
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