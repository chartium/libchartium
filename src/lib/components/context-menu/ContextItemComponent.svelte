<!-- an item of context menu -->

<script lang="ts" generics="T">
  import type { ContextItem } from "./contextMenu.js";

  export let focused: boolean = false;
  export let item: ContextItem<T>;
</script>

{#if item.type === "separator"}
  <div class="context-separator" role="separator" tabindex="-1"></div>
{:else}
  <div
    class="context-item"
    class:context-submenu={item.type === "branch"}
    class:focused
    role="menuitem"
    tabindex="0"
    aria-label={item.ariaLabel ?? String(item.content)}
    on:click={item.type === "leaf" ? item.callback : undefined}
    on:keypress|once
    on:mouseover
    on:focus
  >
    {item.content}
  </div>
{/if}

<style>
  .context-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    padding-left: 10px;
    line-height: 1;

    &:focus {
      outline: none;
    }

    &.focused {
      background-color: var(--libchartium-highlight-background);
    }
  }

  .context-separator {
    height: 1px;
    border-bottom: 1px solid rgb(131, 130, 130, 0.6);
    margin: 4px 0;
  }

  /* caret for branches */
  .context-submenu::after {
    --size: 5px;

    content: "";
    width: 0;
    height: 0;

    border-top: var(--size) solid transparent;
    border-bottom: var(--size) solid transparent;
    border-left: var(--size) solid currentColor;

    padding-left: 4px;
    margin-left: auto;
  }
</style>
