<script lang="ts">
  import ToolbarButton from "./ToolbarButton.svelte";
  import {
    faUpDown,
    faArrowsLeftRightToLine,
  } from "@fortawesome/free-solid-svg-icons";
  import { getContext } from "svelte-typed-context";
  import { toolKey } from "./toolKey.js";
  import { cons, effect, mut } from "@mod.js/signals";
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";

  const autoscaleY$ = getContext(toolKey)?.autoscaleY$;

  const toggleAutoscaleY = () => autoscaleY$?.update((b) => !b);
  const notifyOfAutozoom$ = getContext(toolKey)?.notifyOfAutozoom$;

  let bubbleOpacity$ = mut<number>(+(notifyOfAutozoom$?.get() ?? false));

  effect(($, { defer }) => {
    if (!$(notifyOfAutozoom$ ?? cons(false))) return bubbleOpacity$.set(0);
    const timerID = setTimeout(() => bubbleOpacity$.set(1), 200);
    defer(() => clearTimeout(timerID));
  }).pipe(onDestroy);
</script>

<div class="wrpa">
  <div class="positioned" style:opacity={$bubbleOpacity$}>
    {#if $notifyOfAutozoom$}
      <div class="bubble">
        Y scales<br />automatically
      </div>
    {/if}
  </div>
  <ToolbarButton on:click={toggleAutoscaleY} title="Autoscale Y axis">
    <Fa
      icon={$autoscaleY$ ? faArrowsLeftRightToLine : faUpDown}
      rotate={$autoscaleY$ ? 90 : undefined}
      style={$autoscaleY$ ? "margin: 0px -6px" : undefined}
    />
  </ToolbarButton>
</div>

<style>
  .wrpa {
    position: relative;
  }
  .positioned {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 110%);
    transition: ease-in-out;
    transition-duration: 200ms;
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
