<script lang="ts">
  import { observeOffsetSize } from "./actions.js";

  export let direction: "cw" | "ccw" = "ccw";
  let offsetHeight: number;
  let offsetWidth: number;
</script>

<div
  class="rotate-outer"
  style="width: {offsetHeight}px; height: {offsetWidth}px"
>
  <div
    class="rotate-inner {direction}"
    use:observeOffsetSize={([w, h]) => {
      offsetWidth = w;
      offsetHeight = h;
    }}
  >
    <slot />
  </div>
</div>

<style>
  .rotate-outer {
    display: flex;
    align-items: center;
    justify-content: center;

    margin: 0;
    padding: 0;
  }

  .rotate-inner {
    width: fit-content;
    height: fit-content;

    &.cw {
      transform: rotate(90deg);
    }

    &.ccw {
      transform: rotate(-90deg);
    }
  }
</style>
