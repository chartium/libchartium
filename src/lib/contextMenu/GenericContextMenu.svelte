<svelte:options accessors />

<script lang="ts">
  import type { ContextItem, Point } from "./contextMenu";
  import {
    openPositionNextToPoint,
    openPositionNextToRect,
    clickOutside,
  } from "./contextMenu";

  /** The only required input from outside, the content of the context menu */
  export let items: ContextItem[];
  $: itemsWithIDs = items.map((item, i) => ({ ...item, id: i }));

  /** dic of submenus enumerated by ID */
  let submenus: { [key: number]: any } = {}; // TODO it should be something like { [key: number]: GenericContextMenu } or { [key: number]: typeof this }

  /** only the main menu stays shown when it nor its childern are howered */
  export let main: boolean = true;

  /** Whether this menu is hovered */
  export let thisHovered: boolean = false;

  /** whether any of the submenus of this menu is hovered. */
  export let submenusHovered: boolean = false;

  /** Whether the item that opens this (sub)menu is hovered */
  export let sourceHovered: boolean = false;
  /** whether the menu was summoned by a right click */
  let opened: boolean = false;

  let renderPosition: { x: number; y: number } | undefined = undefined;

  /** opens at the point positionRelativeToPage or if overflow will clamp to edges of viewport */
  export function open(positionRelativeToPage: Point): void {
    opened = true;
    sourceHovered = !main;
    renderPosition = openPositionNextToPoint(
      positionRelativeToPage,
      menuHeight,
      menuWidth
    );
  }

  /** opens on the right of this rect or, if there isnt enough space, on the left */
  export function openNextToRect(rect: DOMRect): void {
    opened = true;
    sourceHovered = true;
    renderPosition = openPositionNextToRect(rect, menuHeight, menuWidth);
  }

  export function close(): void {
    opened = false;
    callPosition = undefined;
  }
  function closeIfNotHovered(): void {
    if (!(thisHovered || sourceHovered || submenusHovered)) {
      close();
    }
  }

  $: if (!(main || thisHovered || sourceHovered || submenusHovered)) {
    close();
  }

  $: visibility = opened ? "visible" : "hidden";

  /** absolute position from where the opening of this context menu was called */
  export let callPosition: { x: number; y: number } | undefined = undefined;

  let menuWidth: number;
  let menuHeight: number;
</script>

<div
  class="context-menu"
  role="menu"
  tabindex="-1"
  style="visibility:{visibility}; position: fixed;
    left: {renderPosition?.x ?? 0}px;
    top:{renderPosition?.y ?? 0}px; z-index: 1; user-select: none;"
  use:clickOutside={closeIfNotHovered}
  bind:clientHeight={menuHeight}
  bind:clientWidth={menuWidth}
  on:mouseover={() => {
    thisHovered = true;
  }}
  on:focus={() => {
    thisHovered = true;
  }}
  on:mouseleave={() => {
    setTimeout(() => {
      thisHovered = false;
    }, 50);
  }}
  on:blur={() => {
    thisHovered = false;
  }}
>
  {#each itemsWithIDs as item}
    {#if item.type === "leaf"}
      <div class="context-item" on:click={item.callback} on:keypress|once>
        {item.content}
      </div>
    {/if}
    {#if item.type === "separator"}
      <div class="context-separator">
        <div
          style="height: 5px; border-bottom: 1px solid rgb(131, 130, 130); margin-bottom: 5px;"
        />
      </div>
    {/if}
    {#if item.type === "branch"}
      <div
        class="context-submenu context-item"
        on:mouseover={(e) => {
          // open the submenu on the right of submenu button
          const rect = e.currentTarget.getBoundingClientRect();
          submenus[item.id].openNextToRect(rect);
        }}
        on:focus={(e) => {
          // open the submenu on the right of submenu button
          const rect = e.currentTarget.getBoundingClientRect();
          submenus[item.id].openNextToRect(rect);
        }}
        on:mouseout={() => {
          setTimeout(() => {
            submenus[item.id].sourceHovered = false;
          }, 50);
        }}
        on:blur={() => {
          setTimeout(() => {
            submenus[item.id].sourceHovered = false;
          }, 50);
        }}
      >
        {item.content}
      </div>
    {/if}
  {/each}
</div>

<!-- these are separate from the tree so they can have their own position relative to screen and render
their themselves corectly in case of overflow -->
{#each itemsWithIDs as item}
  {#if item.type === "branch"}
    <div
      on:mouseleave={() => {
        setTimeout(() => {
          submenusHovered = false;
        }, 50);
      }}
      on:mouseenter={() => {
        submenusHovered = true;
      }}
    >
      <svelte:self
        bind:this={submenus[item.id]}
        items={item.children}
        main={false}
      />
    </div>
  {/if}
{/each}

<style>
  .context-menu {
    border-width: 1px;
    border-style: solid;
    border-color: rgb(131, 130, 130);
    border-radius: 4px;
    background-color: rgb(17, 20, 37);
  }

  .context-item {
    display: flex;
    align-items: start;
    padding: 5px;
    padding-left: 10px;
  }

  .context-item:hover {
    background-color: rgb(75, 75, 75);
  }
</style>
