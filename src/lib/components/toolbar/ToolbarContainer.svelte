<script lang="ts">
  import { faEllipsis } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  export let expandable: boolean = false;

  let expandWidth = 0;
</script>

<div
  class="toolbar"
  style={expandable ? `--expander-width: ${expandWidth}px` : ""}
>
  {#if expandable}
    <div bind:clientWidth={expandWidth}>
      <Fa icon={faEllipsis} />
    </div>
  {/if}
  <slot></slot>
</div>

<style>
  .toolbar {
    position: absolute;
    right: 0;
    top: 0;
    overflow: hidden;

    display: flex;
    flex-flow: row-reverse nowrap;
    align-items: center;
    gap: 0.5em;
    padding: 5px;

    opacity: 0.6;
    transition: all 0.2s ease-in-out;
    width: calc(var(--expander-width, fit-content) + 0.75em);

    &:hover {
      opacity: 0.9;
      width: fit-content;
      background-color: hsla(0, 0%, 5%, 0.6);
    }
  }
</style>
