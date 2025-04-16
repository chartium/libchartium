<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import type { ChartValue, DisplayUnit, Point } from "../../types.js";
  import { globalMouseMove } from "../../utils/mouseActions.js";
  import GenericTooltip from "../../utils/GenericTooltip.svelte";
  import SingleTraceTooltip from "./SingleTraceTooltip.svelte";
  import ManyTracesTooltip from "./ManyTracesTooltip.svelte";
  import type {
    CloseTrace,
    HoveredTrace,
  } from "../../state/interactive/hover.js";
  import type { ChartStyleSheet } from "../../state/core/style.js";

  /** The tooltip will try its best to not be in this rectangle */
  export let forbiddenRectangle:
    | { x: number; y: number; width: number; height: number }
    | undefined = undefined;

  export let nearestTraces: CloseTrace[];
  export let hoveredTrace: HoveredTrace | undefined;
  export let xDisplayUnit: DisplayUnit;
  export let yDisplayUnit: DisplayUnit;
  export let decimalPlaces: number = 3;
  export let previewStyle: "simplified" | "full";
  export let hoverX: ChartValue;
  export let chartStylesheet: Partial<ChartStyleSheet>;

  $: show = nearestTraces.length > 0 || hoveredTrace;

  let position: Point;

  function repairedPosition(
    positionRelativeToPage: Point,
    forbiddenRectangle:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
        }
      | undefined,
  ): Point {
    if (forbiddenRectangle === undefined) {
      return positionRelativeToPage;
    }

    const tooltipXRight = positionRelativeToPage.x;
    const tooltipYBottom = positionRelativeToPage.y;

    const forbiddenXRight = forbiddenRectangle.x + forbiddenRectangle.width;
    const forbiddenYTop = forbiddenRectangle.y;

    if (tooltipYBottom > forbiddenYTop && tooltipXRight < forbiddenXRight) {
      //in rect
      return {
        x: forbiddenXRight,
        y: forbiddenYTop,
      };
    }

    return positionRelativeToPage;
  }

  function updateMousePosition(event: MouseEvent) {
    position = repairedPosition(
      { x: event.clientX, y: event.clientY },
      forbiddenRectangle,
    );
  }
</script>

<div use:globalMouseMove={updateMousePosition}>
  <GenericTooltip position={show ? position : undefined}>
    {#if hoveredTrace !== undefined}
      <SingleTraceTooltip
        {previewStyle}
        {decimalPlaces}
        {hoveredTrace}
        {xDisplayUnit}
        {yDisplayUnit}
      />
    {:else}
      <ManyTracesTooltip
        {hoverX}
        {previewStyle}
        {decimalPlaces}
        {nearestTraces}
        {xDisplayUnit}
        {yDisplayUnit}
        class={chartStylesheet?.tooltip?.manyTraces?.className ?? ""}
        style={chartStylesheet?.tooltip?.manyTraces?.style ?? ""}
      />
    {/if}
  </GenericTooltip>
</div>
