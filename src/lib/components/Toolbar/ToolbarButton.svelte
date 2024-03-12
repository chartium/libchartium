<script lang="ts">
  import { afterUpdate, onMount, tick } from "svelte";
  import GenericTooltip from "../../utils/GenericTooltip.svelte";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  const Fa = Fa_1 as any as typeof Fa_2;

  /** Shown upon hover */
  export let title: string | undefined = undefined;

  /** Shown in place of the slot */
  export let icon: IconDefinition | undefined = undefined;

  let button: HTMLButtonElement;
  let buttonRect: DOMRect;
  afterUpdate(() => {
    buttonRect = button?.getBoundingClientRect();
  });
  $: tooltipPosition =
    buttonRect !== undefined
      ? {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.bottom,
        }
      : undefined;
  let showTooltip = false;
</script>

{#if title !== undefined}
  <GenericTooltip
    position={showTooltip ? tooltipPosition : undefined}
    preferredPositioning="bottom"
  >
    <div class="toolbar">
      {title}
    </div>
  </GenericTooltip>
{/if}

<button
  bind:contentRect={buttonRect}
  bind:this={button}
  on:click={() => {
    showTooltip = false;
  }}
  on:click
  on:mouseenter={() => {
    showTooltip = true;
  }}
  on:focus={() => {
    showTooltip = true;
  }}
  on:mouseleave={() => {
    showTooltip = false;
  }}
  on:blur={() => {
    showTooltip = false;
  }}
>
  <slot>
    {#if icon}
      <Fa {icon} />
    {/if}
  </slot>
</button>

<style>
  button {
    background: none;
    outline: none;
    border: none;

    padding: 0.5em;

    opacity: 0.6;
  }

  button:hover {
    opacity: 1;
  }

  .toolbar {
    margin-top: 3px;
    border-radius: 3px;
    padding: 3px;
    opacity: 0.9;
    background-color: var(--background-color);
  }
</style>
