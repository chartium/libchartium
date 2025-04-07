<!--
  Generic context menu component. Since this component gets recursively nested,
  it exposes many variables the end user never has to worry about. It is not meant to be used directly.
  ContextMenu.svelte wraps this and exposes the only necessary input: the items.
 -->

<script lang="ts" generics="T">
  import { fade } from "svelte/transition";

  import { observeClientSize } from "../../utils/actions.js";

  import { portal } from "svelte-portal";
  import ContextItemComponent from "./ContextItemComponent.svelte";
  import type { ContextItem, Point } from "./contextMenu.js";
  import {
    openPositionNextToPoint,
    openPositionNextToRect,
    mouseDownOutside,
    genericKeydown,
  } from "./contextMenu.js";

  import { tick } from "svelte";

  /** The only required input from outside, the content of the context menu */
  export let items: ContextItem<T>[];

  /** only the main menu stays shown when it nor its children are hovered */
  export let main: boolean = true;

  /** return focus to parent menu when left arrow is pressed */
  export let returnFocus: () => void = () => {};

  /** surrenders focus in favor of currently selected submenu */
  function giveFocus() {
    if (currentlyFocusedIndex === -1) {
      return;
    }
    if (items[currentlyFocusedIndex].type !== "branch") {
      return;
    }
    active = false;
    surrenderedFocus = true;
  }

  /** takes back focus from submenu */
  function takeBackFocus() {
    active = true;
    surrenderedFocus = false;
  }

  /** Whether the menu is being selected from either by a mouse or a keyboard */
  export let active: boolean = false;

  /** Whether the item that opens this (sub)menu is hovered */
  export let sourceActive: boolean = false;

  /** whether the menu was summoned by a right click */
  let opened: boolean = false;

  /** position where to render self */
  let renderPosition: { x: number; y: number } | undefined = undefined;

  /** opens as main menu at the point positionRelativeToPage or if overflow will clamp to edges of viewport */
  export function open(positionRelativeToPage: Point): void {
    if (items.length === 0) {
      console.warn("Tried to open an empty context menu");
      return;
    }

    opened = active = sourceActive = true;
    renderPosition = openPositionNextToPoint(
      positionRelativeToPage,
      menuHeight,
      menuWidth,
    );
  }

  /** Rect next to which a submenu should open */
  export let sourceRect: DOMRect | undefined = undefined;

  /** opens on the right of this rect or, if there isn't enough space, on the left */
  export async function openNextToSourceRect(): Promise<void> {
    if (sourceRect === undefined) return;

    opened = sourceActive = true;

    await tick();

    renderPosition = openPositionNextToRect(sourceRect, menuHeight, menuWidth);
  }

  $: if (sourceActive) {
    setTimeout(() => {
      openNextToSourceRect();
    }, 10);
  }

  export function close(): void {
    currentlyFocusedIndex = -1;
    currentlySelectedRect = undefined;
    active = false;
    opened = false;
    callPosition = undefined;

    if (!main) {
      returnFocus();
    }
  }

  $: if (!sourceActive && opened) {
    close();
  }

  $: visibility = opened ? "visible" : "hidden";

  /** absolute position from where the opening of this context menu was called */
  export let callPosition: { x: number; y: number } | undefined = undefined;

  let menuWidth: number;
  let menuHeight: number;

  /** DOMRect of currently selected context item (submenu will open next to it) */
  let currentlySelectedRect: DOMRect | undefined = undefined;

  /** Which item is currently focused */
  export let currentlyFocusedIndex: number = -1;

  /** Whether a submenu took focus */
  let surrenderedFocus: boolean = false;

  const mod = (a: number, b: number) => (b + (a % b)) % b;
  function handleKeyboardNavigation(event: KeyboardEvent) {
    if (event.key === "Escape") return close();
    if (!active) return;

    const dir =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;

    if (dir !== 0) {
      // cycle through the items, skipping separators
      let next = currentlyFocusedIndex;
      do {
        next = mod(next + dir, items.length);
      } while (items[next].type === "separator");

      (element.children[next] as HTMLElement).focus();
    } else if (event.key === "ArrowLeft") {
      if (!main && !surrenderedFocus) {
        active = false;
        currentlyFocusedIndex = -1;
        setTimeout(() => {
          returnFocus();
        }, 10);
      }
    } else if (event.key === "ArrowRight") {
      giveFocus();
    } else if (event.key === "Enter") {
      const item = items[currentlyFocusedIndex];

      if (item.type === "leaf") item.callback?.();
      else if (item.type === "branch") giveFocus();
    }
  }

  const activateIdx = (idx: number) => (e: Event) => {
    if (opened) {
      currentlyFocusedIndex = idx;
      active = true;
      currentlySelectedRect = (
        e.currentTarget! as HTMLElement
      ).getBoundingClientRect();
    }
  };

  let element: HTMLDivElement;
</script>

{#if visibility !== "hidden"}
  <div
    class="context-menu"
    role="menu"
    tabindex="-1"
    style="left:{renderPosition?.x ?? 0}px;
    top:{renderPosition?.y ?? 0}px;"
    bind:this={element}
    use:mouseDownOutside={close}
    use:genericKeydown={handleKeyboardNavigation}
    use:observeClientSize={([w, h]) => {
      menuWidth = w;
      menuHeight = h;
    }}
    use:portal
    in:fade={{ duration: 100, delay: main ? 0 : 200 }}
    on:mousedown|stopPropagation
  >
    {#each items as item, index}
      {@const activate = activateIdx(index)}

      <ContextItemComponent
        {item}
        focused={currentlyFocusedIndex === index && item.type !== "separator"}
        on:mouseover={activate}
        on:focus={activate}
      />

      {#if item.type === "branch"}
        {@const sourceActive = currentlyFocusedIndex === index}
        {@const active = sourceActive && surrenderedFocus}

        <svelte:self
          items={item.children}
          main={false}
          currentlyFocusedIndex={active ? 0 : -1}
          {active}
          {sourceActive}
          sourceRect={currentlySelectedRect}
          returnFocus={takeBackFocus}
        />
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    --radius: 8px;

    border: none;
    border-radius: var(--radius);
    background-color: var(--libchartium-secondary-background);
    padding: var(--radius) 0;

    position: fixed;
    user-select: none;
    z-index: var(--libchartium-popup-z-index, 100);

    box-shadow: 0px 2px 6px 1px rgba(0, 0, 0, 0.3);
  }
</style>
