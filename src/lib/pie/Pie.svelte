<script lang="ts">
  import type { StatsTable } from "../mod.js";
  import { observeClientSize } from "../utils/actions.js";
  import LabelLine from "./LabelLine.svelte";
  import { layoutPieChart } from "./pie.js";

  export let table: StatsTable<any>;
  export let statTitle: string;

  const DEG = Math.PI / 180;

  let contentSize: [number, number] | undefined;
  $: [width, height] = contentSize ?? [0, 0];

  $: layout =
    width !== 0 && height !== 0
      ? layoutPieChart({ table, statTitle, width, height })
      : undefined;

  $: radius = layout?.radius ?? 0;
</script>

<div
  style="height: 100%; width: 100%; position: relative"
  use:observeClientSize={(s) => (contentSize = s)}
>
  <svg
    viewBox="-{width / 2} -{height / 2} {width} {height}"
    cx="0"
    cy="0"
    {width}
    {height}
  >
    {#each layout?.variants ?? [] as variant}
      {@const largeArc = variant.endDeg - variant.startDeg > 180}
      <path
        d="
        M 0 0
        L {radius * Math.sin(variant.startDeg * DEG)} {-radius *
          Math.cos(variant.startDeg * DEG)}
        A {radius} {radius} 0 {largeArc ? 1 : 0} 1 {radius *
          Math.sin(variant.endDeg * DEG)} {-radius *
          Math.cos(variant.endDeg * DEG)}
        Z"
        fill={variant.style.color}
      />
    {/each}
    {#each layout?.labels ?? [] as label}
      <rect
        x={label.x_min}
        y={label.y_min}
        width={label.x_max - label.x_min}
        height={label.y_max - label.y_min}
        fill="hsl(0 0 100 / 50%)"
      />
    {/each}
    {#each layout?.labels ?? [] as label}
      <LabelLine
        from={[
          radius * Math.sin(label.variant.midpointDeg * DEG),
          -radius * Math.cos(label.variant.midpointDeg * DEG),
        ]}
        to={[
          label.variant.midpointDeg <= 180 ? label.x_min : label.x_max,
          label.y_min + (label.y_max - label.y_min) / 2,
        ]}
      />
    {/each}
  </svg>
  <div class="labels" style:color="black">
    {#each layout?.labels ?? [] as label}
      <span
        style={`
          position: absolute;
          left: ${label.x_min + width / 2}px;
          top: ${label.y_min + height / 2}px;
          width: ${label.x_max - label.x_min}px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `}>{label.variant.label ?? label.variant.id}</span
      >
    {/each}
  </div>
</div>
