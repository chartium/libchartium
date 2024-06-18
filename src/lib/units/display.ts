import {
  Quantity,
  Unit,
  isQuantity,
  isUnit,
  type DataUnit,
  type DisplayUnit,
  type DisplayUnitPreference,
  type ChartRange,
} from "../types.js";
import { DateFormat, isDateFormat } from "../utils/dateFormat.js";
import { isNumericDateRepresentation } from "../utils/numericDateRepresentation.js";

export const isDisplayUnitValidForDataUnit = (
  displayUnit: DisplayUnit,
  dataUnit: DataUnit,
): boolean => {
  if (dataUnit === undefined) return displayUnit === undefined;
  if (isDateFormat(displayUnit)) return isNumericDateRepresentation(dataUnit);
  if (isNumericDateRepresentation(dataUnit)) return isDateFormat(displayUnit);
  try {
    new Quantity(1, dataUnit).inUnits(displayUnit!);
    return true;
  } catch {
    return false;
  }
};

export const dataUnitToDisplayUnit = (u: DataUnit): DisplayUnit =>
  isNumericDateRepresentation(u) ? new DateFormat() : u;

export const bestDisplayUnit = (dataUnit: DataUnit, range: ChartRange) => {
  if (isUnit(dataUnit)) {
    const { to } = range;
    const dataUnit_ = dataUnit as Unit;

    if (typeof to === "number") dataUnit = dataUnit_.withBestFactorFor(to);
    else if (isQuantity(to)) {
      const to_ = to as Quantity;

      dataUnit = dataUnit_.withBestFactorFor(
        to_.unit.conversionFactorTo(dataUnit_) * to_.value,
      );
    }
  }

  return dataUnitToDisplayUnit(dataUnit);
};

export const computeDefaultUnit = (
  dataUnit: DataUnit,
  displayUnitPreference: DisplayUnitPreference,
  range: ChartRange,
) => {
  switch (displayUnitPreference) {
    case "data":
      return dataUnitToDisplayUnit(dataUnit);

    case "auto":
      return bestDisplayUnit(dataUnit, range);

    default:
      if (isDisplayUnitValidForDataUnit(displayUnitPreference, dataUnit)) {
        return displayUnitPreference;
      } else {
        console.warn(
          `The specified display unit "${displayUnitPreference}" is invalid for the data unit "${dataUnit}"`,
        );
        return dataUnitToDisplayUnit(dataUnit);
      }
  }
};
