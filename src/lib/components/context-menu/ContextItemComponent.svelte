<!-- an item of context menu -->

<script lang="ts" generics="T">
  import type { ContextItem } from "./contextMenu.js";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  let boundingDiv: HTMLDivElement;

  function screamBoundingRectIntoTheVoid() {
    const rect = boundingDiv.getBoundingClientRect();
    dispatch("select", {
      rect: rect,
    });
  }

  $: if (focused && boundingDiv !== undefined) {
    boundingDiv.focus();
    screamBoundingRectIntoTheVoid();
  }

  export let focused: boolean = false;
  export let item: ContextItem<T>;
</script>

{#if item.type === "leaf"}
  <div
    class="context-item"
    class:focused
    role="menuitem"
    tabindex="0"
    aria-label={item.ariaLabel ?? String(item.content)}
    bind:this={boundingDiv}
    on:click={item.callback}
    on:keypress|once
    on:mouseover
    on:focus
  >
    {item.content}
  </div>
{:else if item.type === "branch"}
  <div
    class="context-submenu context-item"
    class:focused
    role="menuitem"
    tabindex="0"
    aria-label={item.ariaLabel ?? String(item.content)}
    bind:this={boundingDiv}
    on:mouseover
    on:focus
  >
    {item.content}
  </div>
{:else if item.type === "separator"}
  <div class="context-separator" role="separator" bind:this={boundingDiv}>
    <div />
  </div>
{/if}

<style lang="scss">
  div:focus {
    outline: none;
  }

  .context-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    padding-left: 10px;
    line-height: 1;
  }

  .focused {
    background-color: var(--libchartium-highlight-background);
  }

  .context-separator > div {
    height: 1px;
    border-bottom: 1px solid rgb(131, 130, 130, 0.6);
    margin: 4px 0;
  }

  .context-submenu::after {
    $size: 5px;

    content: "";
    width: 0;
    height: 0;

    border-top: $size solid transparent;
    border-bottom: $size solid transparent;
    border-left: $size solid currentColor;

    padding-left: 4px;
    margin-left: auto;
  }
</style>
