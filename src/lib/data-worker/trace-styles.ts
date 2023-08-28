import {
  colorStringToColor,
  randomContrastingColor,
  type Color,
} from "../../utils/color";
import { yeet } from "../../utils/yeet";
import { UnknownTraceHandleError } from "../errors";
import type { TraceHandle } from "../types";
import { lib } from "./wasm";

export interface TraceStyle {
  width: number;
  color: TraceColor | string;
  display: "line" | "points";
}

export type TraceStylesheet = Record<string, Partial<TraceStyle>>;

// the `as any` casts guarantee that the `TraceColor | string`
// type isn't automatically reduced to just `string`
export enum TraceColor {
  ContrastWithBoth = "contrast-with-both" as any,
  ContrastWithLight = "contrast-with-light" as any,
  ContrastWithDark = "contrast-with-dark" as any,
}

const defaultStyle: TraceStyle = {
  width: 1,
  color: TraceColor.ContrastWithBoth,
  display: "line",
};

interface RawTraceStyle {
  width: number;
  color: Color;
  points_mode: boolean;
}

/**
 * Take a user-defined stylesheet, and apply it to
 * all the available traces, creating a list of TraceStyle's
 */
export function* computeStyles(
  stylesheet: TraceStylesheet,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>
): Iterable<RawTraceStyle> {
  const baseStyle: TraceStyle = {
    ...defaultStyle,
    ...stylesheet?.["*"],
  };

  const resolvedStylesheet = new Map(
    Object.entries(stylesheet ?? {}).map(([t, s]): [string, TraceStyle] => [
      t,
      { ...baseStyle, ...s },
    ])
  );

  for (const handle of traces) {
    const id = ids.get(handle) ?? yeet(UnknownTraceHandleError, handle);

    const { width, display, color } = resolvedStylesheet.get(id) ?? baseStyle;

    let [r, g, b] = (() => {
      switch (color) {
        case TraceColor.ContrastWithBoth:
          return randomContrastingColor(id, true, true);
        case TraceColor.ContrastWithLight:
          return randomContrastingColor(id, true, false);
        case TraceColor.ContrastWithDark:
          return randomContrastingColor(id, false, true);
        default:
          return colorStringToColor(color);
      }
    })();

    yield {
      width,
      color: [r, g, b],
      points_mode: display === "points",
    };
  }
}

/** Remove styles that don't apply to any trace */
export function reduceStylesheet(
  stylesheet: TraceStylesheet,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>
): TraceStylesheet {
  const usedIds = new Set<string>();
  for (const handle of traces)
    usedIds.add(ids.get(handle) ?? yeet(UnknownTraceHandleError, handle));

  return Object.fromEntries(
    Object.entries(stylesheet).filter(
      ([selector, _props]) => selector === "*" || usedIds.has(selector)
    )
  );
}

const deleteSuperfluous = (base: TraceStyle, derived: Partial<TraceStyle>) => {
  if (derived.color === base.color) delete derived.color;
  if (derived.display === base.display) delete derived.display;
  if (derived.width === base.width) delete derived.width;
};

const isEmptyStyle = (style: Partial<TraceStyle>) =>
  style.color === undefined &&
  style.display === undefined &&
  style.width === undefined;

export function stylesheetNormalForm(
  stylesheet: TraceStylesheet,
  traces: Iterable<TraceHandle>,
  ids: Map<TraceHandle, string>
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
