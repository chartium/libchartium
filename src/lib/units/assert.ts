import { isUnit, type DataUnit, type DisplayUnit } from "../types.js";
import { isDateFormat } from "../utils/dateFormat.js";
import { isNumericDateRepresentation } from "../utils/numericDateRepresentation.js";

export function areUnitsCompatible(
  a: DataUnit | DisplayUnit,
  b: DataUnit | DisplayUnit,
): boolean {
  if (a === undefined) {
    if (b === undefined) return true;
    if (isUnit(b)) return b.isUnitless;
    return false;
  }
  if (b === undefined) return isUnit(a) && a.isUnitless;
  if (isNumericDateRepresentation(a) || isDateFormat(a))
    return isNumericDateRepresentation(b) || isDateFormat(b);
  if (isNumericDateRepresentation(b) || isDateFormat(b)) return false;
  return a.isCompatible(b);
}

export function assertAllUnitsCompatible(
  units: Iterable<DataUnit | DisplayUnit>,
) {
  const arr = [...units];
  const first = arr.pop();
  for (const next of arr) {
    if (!areUnitsCompatible(first, next)) {
      throw new TypeError(
        `Incompatible units: "${first}" is not compatible with "${next}"`,
      );
    }
  }
}
