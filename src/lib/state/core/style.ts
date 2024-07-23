import type { TraceStyle } from "../../data/trace-styles.js";

export const defaultAxisStyle: ResolvedGuidelineStyle = {
  color: "rgba(128, 128, 128, 1)",
  line: "solid",
  "line-width": 1,
  "line-dash-array": [5],
};

export const defaultGuidelineStyle: ResolvedGuidelineStyle = {
  color: "rgba(128, 128, 128, 0.4)",
  line: "dashed",
  "line-width": 1,
  "line-dash-array": [5],
};

export const defaultBackgroundStyle: ResolvedBackgroundStyle = {
  color: "transparent",
};

export type GuidelineColor = (string & NonNullable<unknown>) | "unset";

export interface GuidelineStyle
  extends Pick<TraceStyle, "line" | "line-width"> {
  "line-dash-array": number | number[] | "unset";
  color: GuidelineColor;
}

export interface BackgroundStyle {
  color: GuidelineColor;
}

export interface TickStyle {
  style: string;
  class: string;
}
export interface BubbleStyle {
  style: string;
  class: string;
  decimalPlaces: number;
}
export interface TooltipStyle {
  manyTraces: Partial<{
    style: string;
    class: string;
  }>;
  // singleTrace: {
  //   style: string;
  //   class: string;
  // }
}
export interface LegendStyle {
  style: string;
  class: string;
}

export interface ChartStyleSheet {
  background: Partial<BackgroundStyle>;

  axis: Partial<GuidelineStyle>;
  "axis.x": Partial<GuidelineStyle>;
  "axis.y": Partial<GuidelineStyle>;

  guideline: Partial<GuidelineStyle>;
  "guideline.vertical": Partial<GuidelineStyle>;
  "guideline.horizontal": Partial<GuidelineStyle>;

  ticks: Partial<TickStyle>;
  "ticks.x": Partial<TickStyle>;
  "ticks.y": Partial<TickStyle>;

  bubbles: Partial<BubbleStyle>;
  "bubble.x": Partial<BubbleStyle>;
  "bubble.y": Partial<BubbleStyle>;

  tooltip: Partial<TooltipStyle>;

  legend: Partial<LegendStyle>;
}

function orDefault<T>(value: T | "unset" | undefined, def: T): T {
  if (value === undefined || value === "unset") return def;
  return value;
}
function defaultProps<T>(obj: { [K in keyof T]?: T[K] | "unset" }, def: T): T {
  return <T>(
    Object.fromEntries(
      (Object.entries(def as object) as [keyof T, any][]).map(([key, _]) => [
        key,
        orDefault(obj[key], def[key]),
      ]),
    )
  );
}
function normalizeDashedArray(
  v: number | number[] | undefined | "unset",
): number[] | "unset" {
  if (Array.isArray(v)) return v;
  if (typeof v === "number") return [v];
  return "unset";
}

export interface ResolvedGuidelineStyle {
  color: string;
  line: "none" | "solid" | "dashed";
  "line-width": number;
  "line-dash-array": number[];
}
export interface ResolvedBackgroundStyle {
  color: string;
}
export interface ResolvedChartStyleSheet {
  "axis.x": ResolvedGuidelineStyle;
  "axis.y": ResolvedGuidelineStyle;
  "guideline.vertical": ResolvedGuidelineStyle;
  "guideline.horizontal": ResolvedGuidelineStyle;
  background: ResolvedBackgroundStyle;
}

export function resolveChartStyleSheet(
  sheet: Partial<ChartStyleSheet>,
): ResolvedChartStyleSheet {
  const [xAxis, yAxis] = [sheet["axis.x"], sheet["axis.y"]]
    .map((style) => ({
      ...sheet["axis"],
      ...style,
    }))
    .map((style) => ({
      ...style,
      "line-dash-array": normalizeDashedArray(style["line-dash-array"]),
    }))
    .map((style) => defaultProps(style, defaultAxisStyle));

  const [hGuide, vGuide] = [
    sheet["guideline.horizontal"],
    sheet["guideline.vertical"],
  ]
    .map((style) => ({
      ...sheet["guideline"],
      ...style,
    }))
    .map((style) => ({
      ...style,
      "line-dash-array": normalizeDashedArray(style["line-dash-array"]),
    }))
    .map((style) => defaultProps(style, defaultGuidelineStyle));

  const background = defaultProps(
    sheet.background ?? {},
    defaultBackgroundStyle,
  );

  return {
    background,
    "axis.x": xAxis,
    "axis.y": yAxis,
    "guideline.horizontal": hGuide,
    "guideline.vertical": vGuide,
  };
}
