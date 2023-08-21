import { colorStringToColor, randomContrastingColor } from "../../utils/color";
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

/**
 * Take a user-defined stylesheet, and apply it to
 * all the available traces, creating a list of TraceStyle's
 */
export function computeStyles(
  stylesheet: TraceStylesheet,
  traces: Uint32Array | TraceHandle[],
  ids: Map<TraceHandle, string>
): lib.TraceStyle[] {
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

  const styles: lib.TraceStyle[] = [];
  for (const handle of traces) {
    const id =
      ids.get(handle as TraceHandle) ?? yeet(UnknownTraceHandleError, handle);

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

    const style = new lib.TraceStyle(width, r, g, b, display === "points");
    styles.push(style);
  }
  return styles;
}

/** Remove styles that don't apply to any trace */
export function reduceStylesheet(
  stylesheet: TraceStylesheet,
  traces: Uint32Array | TraceHandle[],
  ids: Map<TraceHandle, string>
): TraceStylesheet {
  const usedIds = new Set<string>();
  for (const handle of traces)
    usedIds.add(
      ids.get(handle as TraceHandle) ?? yeet(UnknownTraceHandleError, handle)
    );

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
  traces: Uint32Array | TraceHandle[],
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
