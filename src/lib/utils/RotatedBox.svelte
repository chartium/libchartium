<script lang="ts">
  export let direction: "cw" | "ccw" = "ccw";
  let offsetHeight: number;
  let offsetWidth: number;
</script>

<div
  class="rotate-outer"
  style="width: {offsetHeight}px; height: {offsetWidth}px"
>
  <div class="rotate-inner {direction}" bind:offsetHeight bind:offsetWidth>
    <slot />
  </div>
</div>

<style lang="scss">
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

    :global(.cw) {
      transform: rotate(90deg);
    }

    :global(.ccw) {
      transform: rotate(-90deg);
    }
  }
</style>
