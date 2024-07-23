<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import type { ChartValue, DisplayUnit, Point } from "../../types.js";
  import { globalMouseMove } from "../../utils/mouseActions.js";
  import GenericTooltip from "../../utils/GenericTooltip.svelte";
  import SingleTraceTootlip from "./SingleTraceTootlip.svelte";
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

    const tooltipXright = positionRelativeToPage.x;
    const tooltipYbottom = positionRelativeToPage.y;

    const forbiddenXright = forbiddenRectangle.x + forbiddenRectangle.width;
    const forbiddenYtop = forbiddenRectangle.y;

    if (tooltipYbottom > forbiddenYtop && tooltipXright < forbiddenXright) {
      //in rect
      return {
        x: forbiddenXright,
        y: forbiddenYtop,
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
      <SingleTraceTootlip
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
        class={chartStylesheet?.tooltip?.manyTraces?.class ?? ""}
        style={chartStylesheet?.tooltip?.manyTraces?.style ?? ""}
      />
    {/if}
  </GenericTooltip>
</div>
