import { formatFloat, type QuantityFormatOptions } from "unitlib";
import { isQuantity, type ChartValue, type DisplayUnit } from "../types.js";
import { isDateFormat, type Period } from "../utils/dateFormat.js";

export interface FormatChartValueOptions extends QuantityFormatOptions {
  unit?: DisplayUnit;
  dateAccuracy?: Period;
}

/** Formats input based on options */
export function formatChartValue(
  input: ChartValue,
  options: FormatChartValueOptions = {},
): string {
  options = { ...options };
  options.decimalPlaces ??= 2;
  options.digitGroupLength ??= 3;
  options.fancyUnicode ??= true;
  options.dateAccuracy ??= "minutes";

  if (typeof input === "number") {
    if (isNaN(input)) return "—";
    return formatFloat(input, options);
  } else if (isQuantity(input)) {
    if (isNaN(input.value)) return "—";
    if (options.unit) {
      try {
        if (isDateFormat(options.unit)) throw "";
        input = input.inUnits(options.unit);
      } catch {}
    }
    return input.toString(options);
  } else {
    if (isDateFormat(options.unit)) {
      return options.unit.formatWithAccuracy(input, options.dateAccuracy);
    }
    return input.utc().format("YYYY-MM-DD");
  }
}
