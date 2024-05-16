<script lang="ts">
  import { faUpDown } from "@fortawesome/free-solid-svg-icons";
  import { getContext } from "svelte-typed-context";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { cons, effect, mut } from "@mod.js/signals";
  import { onDestroy } from "svelte";
  const toggleAutoscaleY = getContext(toolKey)?.toggleAutoscaleY;
  const notifyOfAutozoom$ = getContext(toolKey)?.notifyOfAutozoom$;

  let opacity$ = mut<number>(+!notifyOfAutozoom$?.get() ?? 0);
  effect(($, { defer }) => {
    if (!$(notifyOfAutozoom$ ?? cons(false))) return opacity$.set(0);
    const timerID = setTimeout(() => opacity$.set(1), 500);
    defer(() => clearTimeout(timerID));
  }).pipe(onDestroy);
</script>

<div class="wrpa">
  <div class="positioned" style:opacity={$opacity$}>
    <div class="bubble">Y scales<br />automatically</div>
  </div>
  <ToolbarButton
    on:click={toggleAutoscaleY}
    icon={faUpDown}
    title="Autoscale Y axis"
  />
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
