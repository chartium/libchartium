/** Writes exponential notation that doesnt make your eyes bleed */
export function prettyExp(input: number, decimals: number): string {
  const exp = Math.floor(Math.log10(input));
  const mantissa = input / Math.pow(10, exp);
  return `${mantissa.toFixed(decimals)}×10<sup>${exp}</sup>`;
}

/** checks if all numbers of an array can be uniquely written with fixed decimals */
export function fitsIntoDecimals(arr: number[], numOfDeciamls = 2): boolean {
  const withFixed = arr.map((el) => el.toFixed(numOfDeciamls));
  return (
    withFixed.filter((item, index) => withFixed.indexOf(item) !== index)
      .length === 0
  );
}
