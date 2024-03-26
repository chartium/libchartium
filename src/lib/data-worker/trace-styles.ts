import { omit } from "lodash-es";

import { colorStringToColor, type Color } from "../utils/color.js";
import { yeet } from "yeet-ts";
import { UnknownTraceHandleError } from "../errors.js";
import type { TraceHandle, Unit } from "../types.js";
import { map } from "../utils/collection.js";
import type { NumericDateFormat } from "../index.js";
import { lib } from "./wasm.js";

export type TraceColor = lib.TraceColor;
export type TraceRandomColorSpace = lib.TraceRandomColorSpace;
export type TraceLineStyle = lib.TraceLineStyle;
export type TracePointsStyle = lib.TracePointsStyle;

export interface TraceStyle {
  width: number | "unset";
  color:
    | TraceRandomColorSpace
    | "bright"
    | "rainbow"
    | (string & NonNullable<unknown>)
    | "unset";
  points: TracePointsStyle | "unset";
  line: TraceLineStyle | "unset";
  "palette-index": number | "unset";
}

export type TraceStylesheet = Record<
  "*" | (string & NonNullable<unknown>),
  Partial<TraceStyle>
>;

export const thresholdStylesheet: TraceStylesheet = {
  "*": {
    points: "none",
    width: 2,
    line: {
      dashed: [5, 5],
    },
  },
};

export interface TraceDataUnits {
  xDataUnit?: Unit | NumericDateFormat;
  yDataUnit?: Unit | NumericDateFormat;
}

export type ResolvedTraceInfo = Array<
  [traces: Set<string>, info: TraceStyle & TraceDataUnits]
>;

export const defaultStyle: TraceStyle = {
  width: 1,
  color: TraceColor.Random("contrast-with-both"),
  points: TracePoints.None,
  line: TraceLine.Solid,
};

interface RawTraceStyle {
  width: number;
  color: Color;
  points_mode: boolean;
  trace_mode: lib.TraceMode;
}

/**
 * Take a user-defined stylesheet, and apply it to
 * all the available traces, creating a list of TraceInfo
 */
export function resolveTraceInfo(
  stylesheet: TraceStylesheet,
  currentStyles: ResolvedTraceInfo,
  traceHandles: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>,
): ResolvedTraceInfo {
  const traces = new Set(
    map(
      traceHandles,
      (handle) => ids.get(handle) ?? yeet(UnknownTraceHandleError, handle),
    ),
  );

  const lowSpecificity: Partial<TraceStyle> = {
    ...omit(stylesheet?.["*"], "xDataUnit", "yDataUnit"),
  };

  const highSpecificity = new Map(
    Object.entries(stylesheet ?? {}).map(([t, s]): [string, TraceStyle] => [
      t,
      {
        ...defaultStyle,
        ...currentStyles.find(([ts]) => ts.has(t))?.[1],
        ...lowSpecificity,
        ...omit(s, "xDataUnit", "yDataUnit"),
      },
    ]),
  );

  const resolved: ResolvedTraceInfo = [];

  // highest specificity styles
  for (const trace of traces) {
    const style = highSpecificity.get(trace);
    if (style === undefined) continue;

    resolved.push([new Set([trace]), style]);
    traces.delete(trace);
  }

  // lowest specificity styles
  resolved.push([
    traces,
    {
      ...defaultStyle,
      ...lowSpecificity,
    },
  ]);

  return resolved;
}

export function simplifyTraceInfo(
  traceInfo: ResolvedTraceInfo,
  traceHandles: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>,
): ResolvedTraceInfo {
  const existingTraces = new Set(
    map(
      traceHandles,
      (handle) => ids.get(handle) ?? yeet(UnknownTraceHandleError, handle),
    ),
  );

  const usedTraces = new Set<string>();
  const newInfo = new Map<TraceStyle & TraceDataUnits, Set<string>>();

  for (const [ts, info] of traceInfo) {
    const serializedInfo = {
      color: info.color,
      points: info.points,
      line: info.line,
      width: info.width,
      xDataUnit: info.xDataUnit,
      yDataUnit: info.yDataUnit,
    } satisfies TraceStyle & TraceDataUnits;

    for (const t of ts) {
      if (!existingTraces.has(t)) continue;
      if (usedTraces.has(t)) continue;

      let newTraces = newInfo.get(serializedInfo);
      if (!newTraces) newInfo.set(serializedInfo, (newTraces = new Set()));

      newTraces.add(t);
    }
  }

  return Array.from(map(newInfo, ([info, traces]) => [traces, info]));
}

export function computeTraceColor(
  id: string,
  color: TraceColor,
): Color | "palette" {
  if (typeof color === "string") return colorStringToColor(color);
  switch (color.strategy) {
    case "random":
      switch (color.space) {
        case "contrast-with-both":
          return randomContrastingColor(id, true, true);
        case "contrast-with-light":
          return randomContrastingColor(id, true, false);
        case "contrast-with-dark":
          return randomContrastingColor(id, false, true);
      }
      break;
    case "palette":
      return "palette";
  }
}
export function rustifyTraceLine(line: TraceLine): lib.TraceMode {
  if (line === "none") return lib.TraceMode.none();
  if (line === "solid") return lib.TraceMode.line();
  if ("firstDash" in line)
    return lib.TraceMode.double_dash(
      line.firstDash.dashLength,
      line.firstDash.gapLength,
      line.secondDash.dashLength,
      line.secondDash.gapLength,
    );
  return lib.TraceMode.dash(line.dashLength, line.gapLength);
}

export function* computeStyles(
  info: ResolvedTraceInfo,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>,
): Iterable<RawTraceStyle> {
  const getStyle = (id: string) => {
    for (const [set, style] of info) if (set.has(id)) return style;
    return undefined;
  };

  for (const handle of traces) {
    const id = ids.get(handle) ?? yeet(UnknownTraceHandleError, handle);
    const {
      width,
      points,
      color,
      line: traceMode,
    } = getStyle(id) ?? defaultStyle;

    const [r, g, b] = computeTraceColor(id, color);

    yield {
      width,
      color: [r, g, b],
      points_mode: showPoints,
      trace_mode: rustifyTraceLine(traceMode),
    };
  }
}

/** Remove styles that don't apply to any trace */
export function reduceStylesheet(
  stylesheet: TraceStylesheet,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>,
): TraceStylesheet {
  const usedIds = new Set<string>();
  for (const handle of traces)
    usedIds.add(ids.get(handle) ?? yeet(UnknownTraceHandleError, handle));

  return Object.fromEntries(
    Object.entries(stylesheet).filter(
      ([selector, _props]) => selector === "*" || usedIds.has(selector),
    ),
  );
}

const deleteSuperfluous = (base: TraceStyle, derived: Partial<TraceStyle>) => {
  if (derived.color === base.color) delete derived.color;
  if (derived.showPoints === base.showPoints) delete derived.showPoints;
  if (derived.width === base.width) delete derived.width;
  if (derived.line === base.line) delete derived.line;
};

const isEmptyStyle = (style: Partial<TraceStyle>) =>
  style.color === undefined &&
  style.showPoints === undefined &&
  style.width === undefined &&
  style.line === undefined;

export function stylesheetNormalForm(
  stylesheet: TraceStylesheet,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>,
): string {
  stylesheet = reduceStylesheet(stylesheet, traces, ids);

  if (stylesheet["*"]) {
    deleteSuperfluous(defaultStyle, stylesheet["*"]);
    if (isEmptyStyle(stylesheet["*"])) delete stylesheet["*"];
  }

  const base = { ...defaultStyle, ...stylesheet["*"] };

  for (const selector of Object.keys(stylesheet)) {
    if (!stylesheet[selector]) delete stylesheet[selector];
    else {
      deleteSuperfluous(base, stylesheet[selector]);
      if (isEmptyStyle(stylesheet[selector])) delete stylesheet[selector];
    }
  }

  return JSON.stringify(stylesheet);
}
