import { startsWith } from "./string";

export type HexColor = `#${string}`;
export type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;

const canvas = new OffscreenCanvas(0, 0);
const context = canvas.getContext("2d")!;

function colorStringToHexOrRgba(color: string): HexColor | RgbaColor {
  context.fillStyle = color;
  color = context.fillStyle;

  if (!color.startsWith("#") || !color.startsWith("rgba")) {
    throw new TypeError(`Unsupported color: ${color}`);
  }

  return context.fillStyle as any;
}

export function colorStringToUint8Array(color: string): Uint8Array {
  const hexOrRgba = colorStringToHexOrRgba(color);

  if (startsWith(hexOrRgba, "#")) {
    const [_, R, r, G, g, B, b] = hexOrRgba;
    const red = parseInt(R + r, 16);
    const green = parseInt(G + g, 16);
    const blue = parseInt(B + b, 16);
    return Uint8Array.from([red, green, blue]);
  }

  const [_, r, g, b] = hexOrRgba.match(
    /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/
  )!;
  return Uint8Array.from([+r, +g, +b]);
}

type Color = [R: number, G: number, B: number];
const deg = 1 / 360;

export function colorToHex(color: Color): string {
  return "#" + color.map((c) => c.toString(16).padStart(2, "0")).join("");
}

export function randomColor(): Color {
  return [0, 0, 0].map(() => Math.floor(255 * Math.random())) as Color;
}

export function randomContrastingColor(): Color {
  // for a tutorial on custom probability distributions see:
  // https://programming.guide/generate-random-value-with-distribution.html

  const h = Math.random();
  const s = Math.sqrt(0.2 + Math.random() * 0.8);
  const l = 0.3 + Math.random() * 0.5;

  // dark violet and dark red are unreadable against dark background
  if (l < 0.55 && (210 * deg < h || h < 10 * deg)) {
    return randomContrastingColor();
  }

  // light yellow is unreadable against white background
  if (l > 0.7 && 30 * deg < h && h < 100 * deg) {
    return randomContrastingColor();
  }

  return hslToColor(h, s, l);
}

export function colorFromStringHash(str: string, seed = 0): Color {
  // cyrb53 hashing algo
  // Sauce: https://blog.trannhat.xyz/generate-a-hash-from-string-in-javascript/
  function hashCode(str: string, seed: number) {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  const hash = hashCode(str, seed);

  const h = (hash % 360) * deg;
  const s = Math.sqrt(0.2 + ((hash % 1303) * 0.8) / 1303);
  const l = 0.3 + ((hash % 1327) * 0.5) / 1327;

  // dark violet and dark red are unreadable against dark background
  if (l < 0.55 && (210 * deg < h || h < 10 * deg)) {
    return colorFromStringHash(str, seed + 1);
  }

  // light yellow is unreadable against white background
  if (l > 0.7 && 30 * deg < h && h < 100 * deg) {
    return colorFromStringHash(str, seed + 1);
  }

  return hslToColor(h, s, l);
}

// HSL to RGB
// https://stackoverflow.com/a/9493060/1137334

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/**
 * @param h hue, a value from 0 to 1
 * @param s saturation, a value from 0 to 1
 * @param l lightness, a value from 0 to 1
 */
export function hslToColor(h: number, s: number, l: number): Color {
  let r = 0,
    g = 0,
    b = 0;

  if (s == 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function toUint8ColorOrRandom(
  color: string | Uint8Array | undefined
): Uint8Array {
  if (color === undefined) return Uint8Array.from(randomContrastingColor());
  if (typeof color === "string") return colorStringToUint8Array(color);
  return color;
}
