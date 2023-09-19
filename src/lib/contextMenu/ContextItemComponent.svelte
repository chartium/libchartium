<!-- an item of context menu -->

<script lang="ts" generics="T">
  import type { ContextItem } from "./contextMenu";
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
    <slot />
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
    <slot />
  </div>
{:else if item.type === "separator"}
  <div class="context-separator" role="separator" bind:this={boundingDiv}>
    <div
      style="height: 5px; border-bottom: 1px solid rgb(131, 130, 130); margin-bottom: 5px;"
    />
  </div>
{/if}

<style>
  div:focus {
    outline: none;
  }
  .context-item {
    display: flex;
    align-items: start;
    padding: 5px;
    padding-left: 10px;
  }

  .focused {
    background-color: rgb(75, 75, 75);
  }
</style>
