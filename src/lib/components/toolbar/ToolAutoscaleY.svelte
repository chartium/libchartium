<script lang="ts">
  import ToolbarButton from "./ToolbarButton.svelte";
  import {
    faUpDown,
    faArrowsLeftRightToLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { toolKey } from "./toolKey.js";
  import Fa from "svelte-fa";
  import { fade } from "svelte/transition";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  const { autoscaleY$ } =
    getContext(toolKey) ??
    yeet("Attempting to use a chart tool outside of a chart.");

  const toggleAutoscaleY = () => autoscaleY$?.update((b) => !b);
  const notifyOfAutozoom$ = getContext(toolKey)?.notifyOfAutozoom$;
</script>

<div class="wrapper">
  {#if $notifyOfAutozoom$}
    <div class="positioned" transition:fade={{ duration: 300 }}>
      <div class="bubble">
        Y scales<br />automatically
      </div>
    </div>
  {/if}
  <ToolbarButton on:click={toggleAutoscaleY} title="Autoscale Y axis">
    <Fa
      icon={$autoscaleY$ ? faArrowsLeftRightToLine : faUpDown}
      rotate={$autoscaleY$ ? 90 : undefined}
      style={$autoscaleY$ ? "margin: 0px -6px" : undefined}
    />
  </ToolbarButton>
</div>

<style>
  .wrapper {
    position: relative;
  }
  .positioned {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 110%);
  }
  .bubble {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    padding: 3px;
    background-color: #333333;
    border-radius: 10px;
  }
  .bubble::before {
    content: "";
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 0 10px 10px;
    border-style: solid;
    border-color: transparent transparent #333333;
  }
</style>
