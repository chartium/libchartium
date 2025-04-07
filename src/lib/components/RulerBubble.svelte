<script lang="ts">
  import type { ChartStyleSheet } from "../state/core/style.js";
  import type { ChartValue, DisplayUnit, Point } from "../types.js";
  import { formatChartValue } from "../units/mod.js";
  import { clamp } from "./position.js";
  import type { Signal } from "@typek/signalhead";
  import { measureText } from "../utils/format.js";

  /** position relative to body; i.e. absolute :d */
  export let position: Point;
  export let maxX: number;
  export let maxWidth$: Signal<number> | undefined = undefined;
  export let value: ChartValue | undefined;
  export let axis: "x" | "y";
  export let displayUnit: DisplayUnit;
  export let autoDecimalPlaces = 2;
  export let chartStylesheet: Partial<ChartStyleSheet> = {};

  const decimalPlaces =
    chartStylesheet?.[`bubbles.${axis}`]?.decimalPlaces ??
    chartStylesheet?.bubbles?.decimalPlaces ??
    autoDecimalPlaces;
  const bubbleClass = `${chartStylesheet?.[`bubbles.${axis}`]?.className ?? ""} ${chartStylesheet?.bubbles?.className ?? ""}`;
  let bubbleStyle = `${chartStylesheet?.[`bubbles.${axis}`]?.style ?? ""} ${chartStylesheet?.bubbles?.style ?? ""}`;

  let borderBoxSize: ResizeObserverSize[];
  $: clientWidth = borderBoxSize?.[0].inlineSize ?? 0;
  $: clampedX = clamp(position.x, 0 + clientWidth / 2, maxX - clientWidth / 2);
  $: bubbleText = formatChartValue(value ?? 0, {
    unit: displayUnit,
    decimalPlaces,
  });
  let bubbleMeasure: HTMLDivElement;
  $: scaling =
    chartStylesheet?.[`bubbles.y`]?.scaleToFitAxis && axis == "y"
      ? $maxWidth$ === undefined || bubbleMeasure === undefined
        ? undefined
        : clamp(
            $maxWidth$ / (measureText(bubbleText, bubbleMeasure).width + 20),
            0.65,
            1,
          )
      : 1;

  $: positionedStyle =
    axis === "x"
      ? `left: ${clampedX.toFixed(1)}px; top: ${position.y.toFixed(1)}px; transform: translateX(-50%) scale(${scaling}); transform-origin: right center`
      : `right: ${position.x.toFixed(1)}px; top: ${position.y.toFixed(1)}px; transform: translateY(-50%) scale(${scaling}); transform-origin: right center`;
</script>

<div
  bind:this={bubbleMeasure}
  class="axis-bubble {bubbleClass}"
  style={bubbleStyle}
  style:visibility={"hidden"}
></div>
<div class="positioned" style={positionedStyle} bind:borderBoxSize>
  <div class="axis-bubble {bubbleClass}" style={bubbleStyle}>
    {bubbleText}
  </div>
</div>

<style>
  .positioned {
    padding: 4px;
    position: absolute;
    pointer-events: none;
    user-select: none;
    z-index: var(--libchartium-popup-z-index, 100);
  }

  .axis-bubble {
    background-color: var(--libchartium-secondary-background);
    border-radius: 4px;
    padding: 4px;
    font-size: 0.8rem;
    width: max-content;
    height: max-content;
    overflow: visible;
  }
</style>
