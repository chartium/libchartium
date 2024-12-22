<script lang="ts">
  import Fa from "svelte-fa";
  import GenericTooltip from "../../utils/GenericTooltip.svelte";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

  /** Shown upon hover */
  export let title: string | undefined = undefined;

  /** Shown in place of the slot */
  export let icon: IconDefinition | undefined = undefined;

  let button: HTMLButtonElement;
  let tooltipPosition: { x: number; y: number } | undefined;

  function updateButtonRect() {
    if (!button) return;

    const rect = button.getBoundingClientRect();

    tooltipPosition = {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }

  let showTooltip = false;

  $: showTooltip, updateButtonRect();
</script>

{#if title !== undefined}
  <GenericTooltip
    position={showTooltip ? tooltipPosition : undefined}
    preferredPositioning="bottom"
  >
    <div class="tooltip">
      {title}
    </div>
  </GenericTooltip>
{/if}
<button
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
    padding: 0;
    opacity: 0.6;
  }

  button:hover {
    opacity: 1;
  }

  .tooltip {
    margin-top: 3px;
    border-radius: 3px;
    padding: 3px;
    opacity: 0.9;
    background-color: var(--libchartium-secondary-background);
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
