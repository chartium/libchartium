<script lang="ts">
  import { observeResize } from "../utils/actions.js";

  export let contentSize: [number, number] = [1, 1];
  export let xAxisHeight: number | undefined = undefined;
  export let yAxisWidth: number | undefined = undefined;
</script>

<div class="graph-inner">
  <div class="title">
    <slot name="title" />
  </div>
  <div class="subtitle">
    <slot name="subtitle" />
  </div>
  <div
    class="yticks"
    style:width={yAxisWidth === undefined ? "unset" : `${yAxisWidth}px`}
  >
    <slot name="yticks" />
  </div>
  <div
    class="xticks"
    style:height={xAxisHeight === undefined ? "unset" : `${xAxisHeight}px`}
  >
    <slot name="xticks" />
  </div>
  <div class="content" use:observeResize={(s) => (contentSize = s)}>
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
    overflow: auto;
  }

  .bottom-legend {
    grid-area: bl;
    overflow: auto;
  }

  .xticks,
  .yticks {
    overflow: visible;
    display: flex;
    flex-grow: 1;
  }
</style>
