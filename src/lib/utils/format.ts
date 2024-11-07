/** Writes exponential notation that doesn't make your eyes bleed */
export function prettyExp(input: number, decimals: number): string {
  const exp = Math.floor(Math.log10(input));
  const mantissa = input / Math.pow(10, exp);
  return `${mantissa.toFixed(decimals)}×10<sup>${exp}</sup>`;
}

/** checks if all numbers of an array can be uniquely written with fixed decimals */
export function fitsIntoDecimals(arr: number[], numOfDecimals = 2): boolean {
  const withFixed = arr.map((el) => el.toFixed(numOfDecimals));
  return (
    withFixed.filter((item, index) => withFixed.indexOf(item) !== index)
      .length === 0
  );
}

/** Returns how many decimals <= maxDecimals are needed
 * to uniquely describe each element of the input array */
export function uniqueDecimals(
  arr: number[],
  maxDecimals: number = 10,
): number {
  let i = 0;
  for (; i < maxDecimals; i++) {
    if (fitsIntoDecimals(arr, i)) {
      break;
    }
  }
  return i;
}

/**
 * Return length of `text` in pixels as it would appear inside `element`
 */
export const measureText = (() => {
  let canvas: HTMLCanvasElement | undefined = undefined;
  return (text: string, element: HTMLElement) => {
    if (canvas === undefined) canvas = document.createElement("canvas");

    const ctx = canvas.getContext("2d")!;

    // This API is brand new, released only 8 years ago
    // No need to rush this, Firefox
    const getStyle = (() => {
      if ("computedStyleMap" in element) {
        const style = element.computedStyleMap();
        return (key: string) => style.get(key)?.toString() ?? "";
      } else {
        const style = getComputedStyle(element);
        return (key: string) => style.getPropertyValue(key);
      }
    })();

    ctx.font = ["font-style", "font-weight", "font-size", "font-family"]
      .map(getStyle)
      .join(" ");

    const { width, fontBoundingBoxAscent, fontBoundingBoxDescent } =
      ctx.measureText(text);

    return {
      width,
      height: fontBoundingBoxAscent + fontBoundingBoxDescent,
    };
  };
})();
