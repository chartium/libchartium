import { MISSING_COLOR, colorStringToColor } from "../utils/color.js";
import { traceIds } from "./controller.js";
import { lib } from "./wasm.js";

export type TraceRandomColorSpace = lib.TraceRandomColorSpace;
export type TracePointsStyle = lib.TracePointsStyle;
export type PaletteName = lib.PaletteName;

export interface TraceStyle {
  color:
    | TraceRandomColorSpace
    | PaletteName
    | (string & NonNullable<unknown>)
    | "unset";
  points: TracePointsStyle | "unset";
  line: "none" | "solid" | "dashed" | "unset";
  "line-width": number | "unset";
  "line-dash-array":
    | number
    | [number]
    | [number, number]
    | [number, number, number, number]
    | "unset";
  "palette-index": number | "unset";
  "z-index": number | "unset";
  "legend-priority": number | "unset";
}

export type TraceStyleSheet = Record<
  "*" | (string & NonNullable<unknown>),
  Partial<TraceStyle>
>;

export function oxidizeStyleSheetPatch(
  s: TraceStyleSheet,
): lib.TraceStyleSheetPatch {
  const baseStyle = oxidizeStylePatch(s["*"]);
  const patchBuilder = lib.TraceStyleSheetPatchBuilder.base(baseStyle);
  for (const selector of Object.keys(s)) {
    if (selector === "*") continue;
    const handle = traceIds.getKey(selector);
    if (handle === undefined) continue;
    patchBuilder.add(handle, oxidizeStylePatch(s[selector]));
  }
  return patchBuilder.collect();
}

export function oxidizeStyleSheet(
  s: TraceStyleSheet | undefined,
): lib.TraceStyleSheet {
  if (s === undefined) return lib.TraceStyleSheet.unset();
  return lib.TraceStyleSheet.unset().patch(oxidizeStyleSheetPatch(s));
}

// so that we don't forget to pass a new field
type NonOptionalButPossiblyUndefined<T> = {
  [K in keyof Required<T>]: T[K];
};
const oxidizeStylePatch = (
  s: Partial<TraceStyle> | undefined,
): lib.TraceStylePatch => {
  return {
    color: oxidizeColor(s?.color),
    line: oxidizeLine(s?.line, s?.["line-dash-array"]),

    points: s?.points,
    "line-width": s?.["line-width"],
    "palette-index": s?.["palette-index"],
    "z-index": s?.["z-index"],
    "legend-priority": s?.["legend-priority"],
  } satisfies NonOptionalButPossiblyUndefined<lib.TraceStylePatch>;
};

const oxidizeColor = (
  s: Partial<TraceStyle>["color"],
): lib.TraceStylePatch["color"] => {
  if (s === "unset") return "unset";
  if (s === undefined) return undefined;
  if (lib.is_valid_palette_name(s)) return { "palette-auto": s };
  if (lib.is_trace_random_color_space(s)) return { random: s };
  try {
    const [red, green, blue, alpha] = colorStringToColor(s);
    return { exact: { red, green, blue, alpha } };
  } catch (e) {
    console.warn("Failed while setting color.", e);
    return { exact: MISSING_COLOR };
  }
};

const defaultDashedArray = [5, 5] satisfies TraceStyle["line-dash-array"];
const oxidizeLine = (
  l: Partial<TraceStyle>["line"],
  d: Partial<TraceStyle>["line-dash-array"],
): lib.TraceStylePatch["line"] => {
  if (l !== "dashed") {
    return l;
  }

  if (d === "unset" || d === undefined) return { dashed: defaultDashedArray };
  if (typeof d === "number") return { dashed: [d, d] };
  if (d.length === 1) return { dashed: [d[0], d[0]] };
  if (d.length === 2) return { dashed: d };
  if (d.length === 4) return { "double-dashed": d };

  console.warn(
    `Unsupported number of arguments in line-dash-array. Expected 1, 2 or 4 arguments, got: ${d}`,
  );
  return { dashed: defaultDashedArray };
};
