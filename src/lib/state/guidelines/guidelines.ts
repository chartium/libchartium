import { Defer, effect, type DeferLike, type Signal } from "@typek/signalhead";
import {
  resolveChartStyleSheet,
  type ChartStyleSheet,
  type ResolvedChartStyleSheet,
  type ResolvedGuidelineStyle,
} from "../core/style.js";
import type { Size, Tick } from "../../types.js";
import { physicalSize$ } from "../../utils/actions.js";
import { mapOpt } from "../../utils/mapOpt.js";
import { devicePixelRatio$ } from "../../utils/reactive-globals.js";

export interface GuidelinesProps {
  guidelinesCanvas$: Signal<HTMLCanvasElement | undefined>;

  chartStylesheet$: Signal<Partial<ChartStyleSheet>>;

  xTicks$: Signal<Tick[]>;
  yTicks$: Signal<Tick[]>;

  defer: DeferLike;
}

export const guidelines$ = ({
  guidelinesCanvas$,
  chartStylesheet$,
  xTicks$,
  yTicks$,
  defer: deferLike,
}: GuidelinesProps) => {
  const defer = Defer.from(deferLike);
  const resolvedStyles$ = chartStylesheet$
    .skipEqual()
    .map(resolveChartStyleSheet);

  const ctx$ = guidelinesCanvas$.skipEqual().map((c) => c?.getContext("2d"));

  const canvasPhysicalSize$ = guidelinesCanvas$
    .skipEqual()
    .flatMap((c) => mapOpt(c, physicalSize$))
    .map((size) => {
      if (!size) return;
      const width = Math.round(size.width);
      const height = Math.round(size.height);

      guidelinesCanvas$.get()!.width = width;
      guidelinesCanvas$.get()!.height = height;

      return { width, height };
    });

  effect((S) => {
    const ctx = S(ctx$);
    const size = S(canvasPhysicalSize$);
    if (!ctx || !size) return;

    const styles = S(resolvedStyles$);

    renderGuidelines({
      ctx,
      size,
      styles,
      devicePixelRatio: S(devicePixelRatio$),
      xTicks: S(xTicks$),
      yTicks: S(yTicks$),
    });
  }).pipe(defer);
};

interface RenderGuidelinesProps {
  devicePixelRatio: number;
  ctx: CanvasRenderingContext2D;
  size: Size;
  styles: ResolvedChartStyleSheet;
  xTicks: Tick[];
  yTicks: Tick[];
}
function renderGuidelines({
  ctx,
  size: { width, height },
  styles,
  xTicks,
  yTicks,
}: RenderGuidelinesProps) {
  ctx.reset();

  // render background
  ctx.fillStyle = styles["background"].color;
  ctx.fillRect(0, 0, width, height);

  // render vertical guidelines
  applyStyle(ctx, styles["guideline.vertical"]);
  for (const tick of xTicks) {
    const x = Math.round(tick.position * width);
    drawLine({ ctx, from: [x, 0], to: [x, height] });
  }

  // render horizontal guidelines
  applyStyle(ctx, styles["guideline.horizontal"]);
  for (const tick of yTicks) {
    const y = Math.round((1 - tick.position) * height);
    drawLine({ ctx, from: [0, y], to: [width, y] });
  }

  // render x axis
  const bottom = Math.floor(height - styles["axis.x"]["line-width"] / 2);
  applyStyle(ctx, styles["axis.x"]);
  drawLine({
    ctx,
    from: [0, bottom],
    to: [width, bottom],
  });

  // render y axis
  const left = Math.ceil(styles["axis.y"]["line-width"] / 2);
  applyStyle(ctx, styles["axis.y"]);
  drawLine({
    ctx,
    from: [left, 0],
    to: [left, height],
  });
}

function applyStyle(
  ctx: CanvasRenderingContext2D,
  style: ResolvedGuidelineStyle,
) {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style["line-width"];

  switch (style.line) {
    case "none":
      ctx.strokeStyle = "transparent";
      break;
    case "solid":
      ctx.setLineDash([]);
      break;
    case "dashed":
      ctx.setLineDash(style["line-dash-array"]);
  }
}

function drawLine({
  ctx,
  from,
  to,
}: {
  ctx: CanvasRenderingContext2D;
  from: [number, number];
  to: [number, number];
}) {
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.lineTo(...to);
  ctx.stroke();
}
