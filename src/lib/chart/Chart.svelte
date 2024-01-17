<script lang="ts">
  import type { ChartiumController } from "../data-worker/index.js";
  import type { Quantity, Unit, GeneralizedPoint } from "../types.js";
  import type { TraceInfo, TraceList } from "../data-worker/trace-list.js";
  import type { VisibleAction } from "./ActionsOverlay.svelte";

  import { onDestroy } from "svelte";
  import { Chart } from "./chart.js";

  import ActionsOverlay from "./ActionsOverlay.svelte";
  import ChartGrid from "./ChartGrid.svelte";
  import AxisTicks from "./AxisTicks.svelte";
  import ChartLegend from "./Legend.svelte";
  import Guidelines from "./Guidelines.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { mut, cons, WritableSignal } from "@mod.js/signals";
  import type { Remote } from "comlink";
  import type dayjs from "dayjs";
  import { qndFormat } from "../utils/format.js";
  import type { Dayjs } from "dayjs";
  import type { RangeMargins } from "../utils/rangeMargins.js";

  // SECTION Props

  export let controller: ChartiumController | Remote<ChartiumController>;
  /** All traces in the chart */
  export let traces: TraceList;
  let hiddenTraceIDs: WritableSignal<Set<string>> = mut(new Set<string>());
  /** Only those that aren't hidden */
  $: displayedTraces = traces.withoutTraces($hiddenTraceIDs);

  export let title: string = "";
  export let subtitle: string = "";
  /** Label to be displayed next to x axis. If empty, label will be ommited */
  export let xLabel: string = "";
  /** Label to be displayed next to y axis. If empty, label will be ommited */
  export let yLabel: string = "";

  /**
   * Units that should be displayed on the x axis.
   * The "data" option will display the units of the provided data.
   * The "auto" option (default) will choose the best factor according to the range.
   */
  export let defaultXUnit: Unit | undefined | "auto" | "data" = "auto";

  /**
   * Units that should be displayed on the y axis.
   * The "data" option will display the units of the provided data.
   * The "auto" option (default) will choose the best factor according to the range.
   */
  export let defaultYUnit: Unit | "auto" | "data" = "auto";

  /** Hides the thick line at the edge of the graph */
  export let hideXAxisLine: boolean = false;
  /** Hides the thick line at the edge of the graph */
  export let hideYAxisLine: boolean = false;

  /** Hides only the units on the label, not the name */
  export let hideXLabelUnits: boolean = false;
  /** Hides only the units on the label, not the name */
  export let hideYLabelUnits: boolean = false;

  /** Hides only the numbers */
  export let hideXTicks: boolean = false;
  /** Hides only the numbers */
  export let hideYTicks: boolean = false;

  /** Hides the background graph lines */
  export let hideXGuidelines: boolean = false;
  /** Hides the background graph lines */
  export let hideYGruidelines: boolean = false;

  /** Hides the lines shown upon mouse hover */
  export let hideXRuler: boolean = false;
  /** Hides the lines shown upon mouse hover */
  export let hideYRuler: boolean = false;
  /** Hides the coordinate bubble by the odge of the graph */
  export let hideXBubble: boolean = false;
  /** Hides the coordinate bubble by the odge of the graph */
  export let hideYBubble: boolean = false;

  /** Hides the tooltips shown next to cursor */
  export let hideTooltip: boolean = false;
  /** Sets the number of traces that are shown in the tooltip by users keyboard */
  export let tooltipTracesShown: number | "all" = 2;
  /** Hides the highlighted points on traces that the tooltip is showing info about */
  export let hideHoverPoints: boolean = false;

  export let legendPosition: "none" | "right" | "bottom" = "right";
  /** Refers to the little trace sample, simplified just shows color, full shows real width and stroke style */
  export let legendPreviewStyle: "simplified" | "full" = "simplified";
  /** How many traces to show in the legend */
  export let legendTracesShown: number | "all" = "all";

  /** Disables zooming and moving */ // TODO should this include context menu?
  export let disableInteractivity: boolean = false;

  /** Disables possibility to change X units via context menu on chart axis */
  export let disableXUnitChanges: boolean = false;
  /** Disables possibility to change Y units via context menu on chart axis */
  export let disableYUnitChanges: boolean = false;

  /** Sets position of the lil infobox that shows number of traces and range */
  export let infoboxPosition:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "none" = "top-right";

  /** Forces autozoom to show x = 0 */
  export let showXAxisZero: boolean = false;
  $: chart?.showXAxisZero.set(showXAxisZero);

  /** Forces autozoom to show y = 0 */
  export let showYAxisZero: boolean = false;
  $: chart?.showYAxisZero.set(showYAxisZero);

  export let margins: RangeMargins | undefined = undefined;
  $: chart?.margins.set(margins);

  //!SECTION

  let canvas: HTMLCanvasElement;

  $: offscreenCanvas = canvas ? canvas.transferControlToOffscreen() : undefined;
  $: chartCanvasChanged(offscreenCanvas);
  function chartCanvasChanged(offscreenCanvas: OffscreenCanvas | undefined) {
    if (!offscreenCanvas) return (chart = undefined);

    chart = new Chart(controller, offscreenCanvas, displayedTraces);
    chart.traces.subscribe((t) => {
      displayedTraces = t;
    });
  }

  let chart: Chart | undefined = undefined;
  $: xTicks = chart?.xTicks;
  $: yTicks = chart?.yTicks;

  $: chart?.defaultDisplayUnit.x.set(defaultXUnit);
  $: chart?.defaultDisplayUnit.y.set(defaultYUnit);
  $: xDisplayUnit = chart?.currentDisplayUnit.x;
  $: yDisplayUnit = chart?.currentDisplayUnit.y;
  let xAxisTextSize: ((text: string) => number) | undefined;
  let yAxisTextSize: ((text: string) => number) | undefined;

  // walkaround for svelte 4 random reactivity bug
  $: chartUpdated(chart);
  function chartUpdated(chart: Chart | undefined) {
    if (!chart) return;
    chart.xTextSize = xAxisTextSize;
    chart.yTextSize = yAxisTextSize;
  }

  $: qndFormatOptions = {
    decimals: 2,
    dayjsFormat: "MMM DD, hh:mm:ss",
    unit: $yDisplayUnit,
  };
  const visibleAction = mut<VisibleAction | undefined>(undefined);

  $: (window as any).chart = chart; // FIXME DEBUG

  let contentSize: [number, number] = [1, 1];
  $: if (chart) {
    chart.size.set({
      width: contentSize[0] * devicePixelRatio,
      height: contentSize[1] * devicePixelRatio,
    });
  }

  let showTooltip: boolean = false;
  let hoverXQuantity: number | dayjs.Dayjs | Quantity;
  let hoverYQuantity: number | dayjs.Dayjs | Quantity;
  function updateHoverQuantities(e: MouseEvent) {
    hoverXQuantity = chart?.coordinatesToQuantities(e.offsetX, "x") ?? 0;
    hoverYQuantity = chart?.coordinatesToQuantities(e.offsetY, "y") ?? 0;
  }
  $: closestTraces =
    chart && hoverXQuantity && hoverYQuantity
      ? displayedTraces.findClosestTracesToPoint(
          {
            x: hoverXQuantity,
            y: hoverYQuantity,
          },
          tooltipTracesShown === "all"
            ? displayedTraces.traceCount
            : tooltipTracesShown
        )
      : undefined;
  $: tracesInfo =
    closestTraces?.map((trace) => ({
      styledTrace: trace.traceInfo,
      x: qndFormat(trace.closestPoint.x, qndFormatOptions),
      y: qndFormat(trace.closestPoint.y, qndFormatOptions),
    })) ?? [];

  /** updates highilghted points in visibleAction */
  function updateHighlightPoints(
    chart: Chart | undefined,
    closestTraces:
      | {
          traceInfo: TraceInfo;
          closestPoint: GeneralizedPoint;
        }[]
      | undefined
  ) {
    if (closestTraces === undefined || chart === undefined) {
      visibleAction.set({ highlightedPoints: [] });
    } else {
      const points = closestTraces.map((trace) => ({
        xFraction: chart!.quantitiesToFractions(trace.closestPoint.x, "x"),
        yFraction: chart!.quantitiesToFractions(trace.closestPoint.y, "y"),
        color: trace.traceInfo.color,
        radius: trace.traceInfo.width,
      }));

      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: points,
      }));
    }
  }
  $: updateHighlightPoints(chart, closestTraces);

  $: if (chart) {
    // ideally this would just update but without mousemove we don't know where the mouse is
    chart.range.x.subscribe(() => updateHighlightPoints(chart, []));
    chart.range.y.subscribe(() => updateHighlightPoints(chart, []));
  }

  /** How close to a trace is considered close enough to get only one trace info */
  const closenessDistance = 5;
  let selectedTrace:
    | {
        styledTrace: TraceInfo;
        x: string;
        y: string;
        min: string;
        max: string;
        avg: string;
      }
    | undefined = undefined;

  let traceCloseEnough: boolean;

  $: if (chart && closestTraces && closestTraces?.length !== 0) {
    // FIXME rethink this, this is ew
    traceCloseEnough =
      chart.distanceInPx(closestTraces[0].closestPoint, {
        x: hoverXQuantity,
        y: hoverYQuantity,
      }) < closenessDistance;
  }

  // look for the closest trace to the mouse and if it's close enough, show more info
  $: if (
    chart &&
    closestTraces !== undefined &&
    closestTraces?.length !== 0 &&
    traceCloseEnough
  ) {
    const { from, to } = chart.range.x.get();
    const statsOfClosest = displayedTraces.calculateStatistics({
      traces: [closestTraces[0].traceInfo.id],
      from,
      to,
    })[0];

    selectedTrace = {
      styledTrace: closestTraces[0].traceInfo,
      x: qndFormat(closestTraces[0].closestPoint.x, qndFormatOptions),
      y: qndFormat(closestTraces[0].closestPoint.y, qndFormatOptions),
      min: qndFormat(statsOfClosest.min, qndFormatOptions),
      max: qndFormat(statsOfClosest.max, qndFormatOptions),
      avg: qndFormat(statsOfClosest.avg, qndFormatOptions),
    };
  } else {
    selectedTrace = undefined;
  }

  // forbidden rectangle for tooltip to avoid
  let forbiddenRectangle:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined = undefined;
  // and subscribing it to the zoom action
  onDestroy(
    visibleAction.subscribe((action) => {
      if (!chart) return;
      if (action?.zoom) {
        const canvasRect = canvas.getBoundingClientRect();
        const offsetX = canvasRect.x;
        const offsetY = canvasRect.y;
        forbiddenRectangle = {
          x: action.zoom.x.from * chart.canvas!.width + offsetX,
          y: (1 - action.zoom.y.from) * chart.canvas!.height + offsetY,
          width: (action.zoom.x.to - action.zoom.x.from) * chart.canvas!.width,
          height:
            (action.zoom.y.to - action.zoom.y.from) * chart.canvas!.height,
        };
      } else {
        forbiddenRectangle = undefined;
      }
    })
  );

  /** In fractions of graph height */
  let persistentYThresholds: (Quantity | number | Dayjs)[] = [];
  $: presYThreshFracs = persistentYThresholds.map(
    (q) => chart?.quantitiesToFractions(q, "y") ?? 0
  );
  $: chart?.range.y.subscribe(() => {
    presYThreshFracs = persistentYThresholds.map(
      (q) => chart?.quantitiesToFractions(q, "y") ?? 0
    );
  });

  // FIXME DEBUG
  let addPersistentThreshold: () => void;
  let filterByThreshold: () => void;
  $: (window as any).addPersistentThreshold = addPersistentThreshold;
  $: (window as any).filterByThreshold = filterByThreshold;
</script>

{#if !hideTooltip}
  <Tooltip
    {forbiddenRectangle}
    nearestTracesInfo={tracesInfo}
    singleTraceInfo={selectedTrace}
    show={showTooltip}
    previewStyle={legendPreviewStyle}
  />
{/if}

<ChartGrid bind:contentSize>
  <svelte:fragment slot="title">
    {title}
  </svelte:fragment>
  <svelte:fragment slot="subtitle">
    {subtitle}
  </svelte:fragment>

  <AxisTicks
    slot="yticks"
    axis="y"
    ticks={$yTicks ?? []}
    label={yLabel}
    unit={$yDisplayUnit}
    hideLabelUnits={hideYLabelUnits}
    {visibleAction}
    {disableInteractivity}
    disableUnitChange={disableYUnitChanges}
    hideTicks={hideYTicks}
    on:shift={(d) => chart?.shiftRange(d)}
    on:reset={(d) => chart?.resetZoom("y")}
    raiseFactor={chart?.raiseYFactorAction ?? cons(undefined)}
    lowerFactor={chart?.lowerYFactorAction ?? cons(undefined)}
    resetUnit={chart?.resetYFactorAction ?? cons(undefined)}
    bind:textLength={yAxisTextSize}
  />

  <AxisTicks
    slot="xticks"
    axis="x"
    ticks={$xTicks ?? []}
    label={xLabel}
    unit={$xDisplayUnit}
    hideLabelUnits={hideXLabelUnits}
    {visibleAction}
    {disableInteractivity}
    disableUnitChange={disableXUnitChanges}
    hideTicks={hideXTicks}
    on:shift={(d) => chart?.shiftRange(d)}
    on:reset={() => chart?.resetZoom("x")}
    raiseFactor={chart?.raiseXFactorAction ?? cons(undefined)}
    lowerFactor={chart?.lowerXFactorAction ?? cons(undefined)}
    resetUnit={chart?.resetXFactorAction ?? cons(undefined)}
    bind:textLength={xAxisTextSize}
  />

  <Guidelines
    xTicks={hideXGuidelines ? [] : $xTicks ?? []}
    yTicks={hideYGruidelines ? [] : $yTicks ?? []}
    renderXAxis={!hideXAxisLine}
    renderYAxis={!hideYAxisLine}
  />

  <canvas bind:this={canvas} on:contextmenu|preventDefault />

  {#if $$slots.infobox && infoboxPosition !== "none"}
    <div
      class="infobox"
      style="{infoboxPosition.includes('top') ? 'top' : 'bottom'} : 0.5rem;
      {infoboxPosition.includes('left') ? 'left' : 'right'} : 0.5rem; "
    >
      <slot name="infobox" />
    </div>
  {/if}

  <ActionsOverlay
    {visibleAction}
    {hideHoverPoints}
    {hideXRuler}
    {hideYRuler}
    {hideXBubble}
    {hideYBubble}
    {hoverXQuantity}
    {hoverYQuantity}
    {disableInteractivity}
    {presYThreshFracs}
    bind:filterByThreshold
    bind:addPersistentThreshold
    traceHovered={selectedTrace !== undefined}
    on:reset={() => chart?.resetZoom("xy")}
    on:zoom={(d) => chart?.zoomRange(d)}
    on:shift={(d) => chart?.shiftRange(d)}
    on:yThreshold={(t) => {
      if (t.detail.type === "persistent") {
        const thresholdQ = chart?.fractionsToQuantities(
          1 - t.detail.thresholdFrac,
          "y"
        );
        if (thresholdQ) persistentYThresholds.push(thresholdQ);
        persistentYThresholds = persistentYThresholds;
      }
      if (t.detail.type === "filtering")
        hiddenTraceIDs.update((curr) => {
          for (const id of chart?.idsUnderThreshold(t) ?? []) curr.add(id);
          return curr;
        });
    }}
    on:mousemove={(e) => {
      showTooltip = true;
      updateHoverQuantities(e);
    }}
    on:mouseout={(e) => {
      showTooltip = false;
      closestTraces = [];
      visibleAction.update((action) => ({
        ...action,
        highlightedPoints: [],
      }));
    }}
    on:blur={(e) => {
      showTooltip = false;
    }}
  />

  <div class="toolbar" slot="overlay">
    <slot name="toolbar" />
  </div>

  <svelte:fragment slot="right-legend">
    {#if legendPosition === "right"}
      <ChartLegend
        {traces}
        {hiddenTraceIDs}
        previewStyle={legendPreviewStyle}
        numberOfShownTraces={legendTracesShown === "all"
          ? traces.traceCount
          : legendTracesShown}
      />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="bottom-legend">
    {#if legendPosition === "bottom"}
      <ChartLegend
        {traces}
        {hiddenTraceIDs}
        previewStyle={legendPreviewStyle}
        numberOfShownTraces={legendTracesShown === "all"
          ? traces.traceCount
          : legendTracesShown}
      />
    {/if}
  </svelte:fragment>
</ChartGrid>

<style lang="scss">
  :global(:root) {
    --libchartium-secondary-background: rgb(51, 51, 51);
    --libchartium-highlight-background: rgb(75, 75, 75);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .infobox {
    position: absolute;
    user-select: none;

    text-align: left;
    padding: 0.25rem;

    font-size: 0.8em;
    max-width: 300px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    background: rgba(255, 255, 255, 0.6);

    :global(.dark) & {
      background: rgba(70, 70, 70, 0.6);
    }
  }

  .toolbar {
    position: absolute;
    right: 0;
    top: 0;

    display: flex;
    flex-flow: row nowrap;
    align-items: center;

    opacity: 0.6;
    transition: all 0.2s ease-in-out;

    &:hover {
      opacity: 0.9;
      background-color: #ececec;
    }

    :global(.dark) &:hover {
      background-color: #505050;
    }
  }
</style>
