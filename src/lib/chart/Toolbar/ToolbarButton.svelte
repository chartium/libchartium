<script lang="ts">
  import GenericTooltip from "../../GenericTooltip.svelte";

  /** Shown upon hover */
  export let title: string | undefined = undefined;

  let button: HTMLButtonElement;
  $: buttonRect = button?.getBoundingClientRect();
  $: tooltipPosition =
    buttonRect !== undefined
      ? {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.bottom,
        }
      : undefined;
  let showTooltip = false;
</script>

<svelte:window
  on:resize={() => {
    buttonRect = button?.getBoundingClientRect();
  }}
/>

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
  bind:this={button}
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
  <slot />
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
    padding: 3px;
    opacity: 0.9;
    background-color: #ececec;
  }

  :global(.dark) .toolbar {
    background-color: #505050;
  }
</style>
