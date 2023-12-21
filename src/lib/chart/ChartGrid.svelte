<script lang="ts">
  import { observeResize } from "../utils/actions.js";

  export let contentSize: [number, number] = [1, 1];
</script>

<div class="graph-inner">
  <div class="title">
    <slot name="title" />
  </div>
  <div class="subtitle">
    <slot name="subtitle" />
  </div>
  <div class="ylabel">
    <slot name="ylabel" />
  </div>
  <div class="yticks">
    <slot name="yticks" />
  </div>
  <div class="xticks">
    <slot name="xticks" />
  </div>
  <div class="xlabel">
    <slot name="xlabel" />
  </div>
  <div
    class="content"
    use:observeResize={(size) => {
      contentSize = size;
    }}
  >
    <slot />
  </div>
  <div class="right-legend">
    <slot name="right-legend" />
  </div>
  <div class="bottom-legend">
    <slot name="bottom-legend" />
  </div>
  <slot name="overlay" />
</div>

<style>
  .graph-inner {
    display: grid;
    grid-template:
      "title title title" auto
      "subtitle subtitle subtitle" auto
      "yticks graph rl" 1fr
      "b xticks c" auto
      "bl bl bl" auto / auto 1fr auto;

    /* gap: 0.5rem;  <- exchanged for padding so the "gap" is still clickable*/
    /*  -        Title      -        */
    /*  -        Subtitle   -        */
    /*  YTicks | graph    | (legend) */
    /*  -      | XTicks   | -        */
    /*  -      | (legend) | -        */

    width: 100%;
    height: 100%;

    position: relative;
  }

  .title,
  .subtitle {
    place-self: center;
  }

  .yticks > :global(span) {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
  }

  .title,
  .subtitle {
    line-height: 1;
  }

  .title {
    grid-area: title;
    font-size: 1.25em;
    font-weight: bold;
    padding-bottom: 0.5rem;
  }

  .subtitle {
    grid-area: subtitle;
    padding-bottom: 0.5rem;
  }

  .yticks {
    grid-area: yticks;
  }

  .xticks {
    grid-area: xticks;
  }

  .content {
    grid-area: graph;
    position: relative;
  }

  .right-legend {
    grid-area: rl;
  }

  .bottom-legend {
    grid-area: bl;
  }

  .xticks,
  .yticks {
    overflow: visible;
    display: flex;
    flex-grow: 1;
  }
</style>
