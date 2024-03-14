<!-- Component for displaying a lil tooltip by the cursor that shows info about nearby traces -->
<script lang="ts">
  import type { Point } from "../../types.js";
  import { globalMouseMove } from "../../utils/mouseActions.js";
  import type { TraceInfo } from "../../data-worker/trace-list.js";
  import GenericTooltip from "../../utils/GenericTooltip.svelte";
  import TracePreview from "../TracePreview.svelte";
  import SingleTraceTootlip from "./SingleTraceTootlip.svelte";
  import ManyTracesTooltip from "./ManyTracesTooltip.svelte";

  /** The tooltip will try its best to not be in this rectangle */
  export let forbiddenRectangle:
    | { x: number; y: number; width: number; height: number }
    | undefined = undefined;

  export let nearestTracesInfo: {
    styledTrace: TraceInfo;
    x: string;
    y: string;
  }[];
  export let singleTraceInfo:
    | {
        styledTrace: TraceInfo;
        x: string;
        y: string;
        min: string;
        max: string;
        avg: string;
      }
    | undefined;

  export let previewStyle: "simplified" | "full";

  export let show: boolean;

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
    {#if singleTraceInfo !== undefined}
      <SingleTraceTootlip {previewStyle} {singleTraceInfo} />
    {:else}
      <ManyTracesTooltip {previewStyle} {nearestTracesInfo} />
    {/if}
  </GenericTooltip>
</div>
