import type { lib } from "../data-worker/wasm.js";
import { startsWith } from "./string.js";

// "Missing Texture" magenta
// also see rust/src/utils/color.rs
export const MISSING_COLOR = {
  red: 0xff,
  green: 0x00,
  blue: 0xdc,
  alpha: 0xff,
};

export type HexColor = `#${string}`;
export type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;
export type SrgbColor =
  | `color(srgb ${number} ${number} ${number})`
  | `color(srgb ${number} ${number} ${number} / ${number})`;

// Wrap OffscreenCanvas use, so that it doesn't throw in SSR
const get2DContext = (() => {
  let canvas: OffscreenCanvas;
  let context: OffscreenCanvasRenderingContext2D | undefined;
  return () => {
    if (context) return context;
    if (typeof OffscreenCanvas === "undefined") return;
    canvas = new OffscreenCanvas(0, 0);
    context = canvas.getContext("2d") ?? undefined;
    return context;
  };
})();

function colorStringToHexOrRgba(
  color: string,
): HexColor | RgbaColor | SrgbColor {
  const context = get2DContext();
  if (!context) return color as any;

  // if the color is invalid, setting it as fillColor does nothing
  // therefore we have to try with two different initial colors
  // to distinguish invalid color from the initial color
  for (const c of ["#000000", "#ffffff"]) {
    context.fillStyle = c;
    context.fillStyle = color;
    const resolved = context.fillStyle;
    if (resolved !== c) {
      color = resolved;
      break;
    }
    if (c === "#ffffff") {
      throw new TypeError(`Unsupported color: ${color}`);
    }
  }

  if (
    !color.startsWith("#") &&
    !color.startsWith("rgba") &&
    !color.startsWith("color(srgb")
  ) {
    throw new TypeError(`Unsupported color: ${color}`);
  }

  return color as any;
}

export function colorStringToColor(color: string): Color {
  const hexOrRgba = colorStringToHexOrRgba(color);

  if (startsWith(hexOrRgba, "#")) {
    const [_, R, r, G, g, B, b, A, a] = hexOrRgba;
    const red = parseInt(R + r, 16);
    const green = parseInt(G + g, 16);
    const blue = parseInt(B + b, 16);
    const alpha = A && a ? parseInt(A + a, 16) : 255;
    return [red, green, blue, alpha];
  }

  if (startsWith(hexOrRgba, "rgba(")) {
    const [_, r, g, b, a] = hexOrRgba.match(
      /^rgba\(\s*(\d+)[,\s]\s*(\d+)[,\s]\s*(\d+)(?:[,\s]\s*(\d+(?:\.\d+)?))?\s*\)$/,
    )!;
    return [+r, +g, +b, +(a ?? 1) * 255].map((n) => Math.round(n)) as Color;
  }

  if (startsWith(hexOrRgba, "color(srgb")) {
    const [_, r, g, b, a] = hexOrRgba.match(
      /^color\(srgb\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*\)$/,
    )!;
    return [+r * 255, +g * 255, +b * 255, +(a ?? 1) * 255].map((n) =>
      Math.round(n),
    ) as Color;
  }

  throw new TypeError(`Unsupported color: ${hexOrRgba}`);
}

/**
 * Red, green, blue and alpha in the SRGB space.
 * All values are between 0 and 255.
 */
export type Color = [R: number, G: number, B: number, A: number];
export const isColor = (x: unknown): x is Color =>
  Array.isArray(x) && x.length === 4 && x.every((n) => typeof n === "number");

export function colorToHex(color: Color): `#${string}` {
  return `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function resolvedColorToHex(color: lib.ResolvedColor) {
  return colorToHex([color.red, color.green, color.blue, color.alpha]);
}
