<script lang="ts" generics="T">
  import ContextItemComponent from "./contextItemComponent.svelte";
  import type { ContextItem, Point } from "./contextMenu";
  import {
    openPositionNextToPoint,
    openPositionNextToRect,
    clickOutside,
    genericKeydown
  } from "./contextMenu";

  

  /** The only required input from outside, the content of the context menu */
  export let items: ContextItem<T>[];

  /** only the main menu stays shown when it nor its childern are howered */
  export let main: boolean = true;

  /** return focus to parent menu when left arrow is pressed */
  export let returnFocus: () => void = () => {};

  function giveFocus() {
    if (currentlyFocusedIndex === -1) {
      return;
    }
    active = false;
    surrenderedFocus = true;
  }

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

  let renderPosition: { x: number; y: number } | undefined = undefined;

  /** opens as main menu at the point positionRelativeToPage or if overflow will clamp to edges of viewport */
  export function open(positionRelativeToPage: Point): void {
    opened = true;
    sourceActive = true;
    active = true;
    renderPosition = openPositionNextToPoint(
      positionRelativeToPage,
      menuHeight,
      menuWidth
    );
  }

  /** Rect next to which a submenu should open */
  export let sourceRect: DOMRect | undefined = undefined;

  /** opens on the right of this rect or, if there isnt enough space, on the left */
  export function openNextToSourceRect(): void {
    if (sourceRect === undefined || sourceRect === undefined) {
      return;
    }
    opened = true;
    sourceActive = true;
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

  $: if (!(sourceActive || main)) {
    close();
  }

  $: visibility = opened ? "visible" : "hidden";

  /** absolute position from where the opening of this context menu was called */
  export let callPosition: { x: number; y: number } | undefined = undefined;

  let menuWidth: number;
  let menuHeight: number;

  let currentlySelectedRect: DOMRect | undefined = undefined;

  export let currentlyFocusedIndex: number = -1;

  let surrenderedFocus: boolean = false;

  function handleKeyboardNavigation(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (!active) {
      return;
    }
    if (event.key === "ArrowDown") {
      currentlyFocusedIndex++;
      if (currentlyFocusedIndex >= items.length) {
        currentlyFocusedIndex = 0;
      }
      if (items[currentlyFocusedIndex].type === "separator") {
        currentlyFocusedIndex++;
      }
    } else if (event.key === "ArrowUp") {
      currentlyFocusedIndex--;
      if (currentlyFocusedIndex < 0) {
        currentlyFocusedIndex = items.length - 1;
      }
      if (items[currentlyFocusedIndex].type === "separator") {
        currentlyFocusedIndex--;
      }
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
    }
  }
</script>

<div
  class="context-menu"
  role="menu"
  tabindex="-1"
  aria-hidden={visibility === "hidden"}
  style="visibility:{visibility}; position: fixed;
    left: {renderPosition?.x ?? 0}px;
    top:{renderPosition?.y ?? 0}px; z-index: 1; user-select: none;"
  use:clickOutside={close}
  use:genericKeydown={handleKeyboardNavigation}
  bind:clientHeight={menuHeight}
  bind:clientWidth={menuWidth}
>
  {#each items as item, index}
    <ContextItemComponent
      {item}
      focused={currentlyFocusedIndex === index && item.type !== "separator"}
      on:select={(e) => {
        currentlySelectedRect = e.detail.rect;
      }}
      on:mouseover={(e) => {
        currentlyFocusedIndex = index;
      }}
      on:focus={(e) => {
        currentlyFocusedIndex = index;
      }}
    />
    {#if item.type === "branch"}
      <div role="menu" tabindex="-1">
        <svelte:self
          items={item.children}
          main={false}
          active={currentlyFocusedIndex === index && surrenderedFocus}
          currentlyFocusedIndex={currentlyFocusedIndex === index && surrenderedFocus ? 0 : -1}
          sourceActive={currentlyFocusedIndex === index}
          sourceRect={currentlySelectedRect}
          returnFocus={takeBackFocus}
        />
      </div>
    {/if}
  {/each}
</div>

<style>
  .context-menu {
    border-width: 1px;
    border-style: solid;
    border-color: rgb(131, 130, 130);
    border-radius: 4px;
    background-color: rgb(17, 20, 37);
  }
</style>
