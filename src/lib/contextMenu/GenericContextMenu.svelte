<!--
  Generic context menu component. Since this component gets recursively nested,
  it exposes many variables the end user never has to worry about. It is not meant to be used directly.
  ContextMenu.svelte wraps this and exposes the only necessary input: the items.
 -->

<script lang="ts" generics="T">
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
    opened = true;
    sourceActive = true;
    active = true;
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
    if (sourceRect === undefined) {
      return;
    }
    opened = true;
    sourceActive = true;
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

{#if visibility !== "hidden"}
  <div
    class="context-menu"
    role="menu"
    tabindex="-1"
    style="left:{renderPosition?.x ?? 0}px;
    top:{renderPosition?.y ?? 0}px;"
    use:mouseDownOutside={close}
    use:genericKeydown={handleKeyboardNavigation}
    bind:clientWidth={menuWidth}
    bind:clientHeight={menuHeight}
    use:portal
  >
    {#each items as item, index}
      <ContextItemComponent
        {item}
        focused={currentlyFocusedIndex === index && item.type !== "separator"}
        on:select={(e) => {
          currentlySelectedRect = e.detail.rect;
        }}
        on:mouseover={() => {
          if (opened) {
            currentlyFocusedIndex = index;
            active = true;
          }
        }}
        on:focus={() => {
          if (opened) {
            currentlyFocusedIndex = index;
            active = true;
          }
        }}
      >
        {#if item.type !== "separator"}
          <slot {item}>
            {item.content}
          </slot>
        {/if}
      </ContextItemComponent>
      {#if item.type === "branch"}
        <div
          role="menu"
          tabindex="-1"
          on:mouseover={giveFocus}
          on:focus={giveFocus}
        >
          <svelte:self
            items={item.children}
            main={false}
            active={currentlyFocusedIndex === index && surrenderedFocus}
            currentlyFocusedIndex={currentlyFocusedIndex === index &&
            surrenderedFocus
              ? 0
              : -1}
            sourceActive={currentlyFocusedIndex === index}
            sourceRect={currentlySelectedRect}
            returnFocus={takeBackFocus}
          />
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    border: 1px solid rgb(131, 130, 130);
    border-radius: 4px;
    background-color: var(--libchartium-secondary-background);

    position: fixed;
    user-select: none;
    z-index: 1;
  }
</style>
