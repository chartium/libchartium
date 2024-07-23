<script lang="ts">
  import type { ChartStyleSheet } from "../state/core/style.js";
  import type { ChartValue, DisplayUnit, Point } from "../types.js";
  import { formatChartValue } from "../units/mod.js";

  /** position relative to body; i.e. absolute :d */
  export let position: Point;
  export let value: ChartValue | undefined;
  export let axis: "x" | "y";
  export let displayUnit: DisplayUnit;
  export let autoDecimalPlaces = 2;
  export let chartStylesheet: Partial<ChartStyleSheet> = {};

  const decimalPlaces =
    chartStylesheet?.[`bubbles.${axis}`]?.decimalPlaces ??
    chartStylesheet?.bubbles?.decimalPlaces ??
    autoDecimalPlaces;
  const bubbleClass = `${chartStylesheet?.[`bubbles.${axis}`]?.class ?? ""} ${chartStylesheet?.bubbles?.class ?? ""}`;
  const bubbleStyle = `${chartStylesheet?.[`bubbles.${axis}`]?.style ?? ""} ${chartStylesheet?.bubbles?.style ?? ""}`;

  $: positionedStyle =
    axis === "x"
      ? `left: ${position.x.toFixed(1)}px; top: ${position.y.toFixed(1)}px; transform: translateX(-50%)`
      : `right: ${position.x.toFixed(1)}px; top: ${position.y.toFixed(1)}px; transform: translateY(-50%)`;
</script>

<div class="positioned" style={positionedStyle}>
  <div class="axis-bubble {bubbleClass}" style={bubbleStyle}>
    {formatChartValue(value ?? 0, {
      unit: displayUnit,
      decimalPlaces,
    })}
  </div>
</div>

<style lang="scss">
  .positioned {
    padding: 4px;
    position: absolute;
    pointer-events: none;
    user-select: none;
  }
  .axis-bubble {
    background-color: var(--libchartium-secondary-background);
    border-radius: 4px;
    padding: 4px;
    font-size: 0.8rem;
    z-index: var(--libchartium-popup-z-index, 100);
    width: max-content;
    height: max-content;
    overflow: visible;
  }
</style>
