<script lang="ts">
  export let from: [number, number];
  export let to: [number, number];

  $: dx = to[0] - from[0];
  $: dy = to[1] - from[1];
  $: kneeDist = Math.min(Math.abs(dx), Math.abs(dy));

  $: knee =
    Math.abs(dx) > Math.abs(dy)
      ? [from[0] + Math.sign(dx) * kneeDist, from[1] + Math.sign(dy) * kneeDist]
      : [to[0] - Math.sign(dx) * kneeDist, to[1] - Math.sign(dy) * kneeDist];
</script>

<path
  style:stroke="white"
  style:stroke-width="1px"
  style:fill="none"
  d="
    M {from[0]} {from[1]}
    L {knee[0]} {knee[1]}
    L {to[0]} {to[1]}
  "
/>
