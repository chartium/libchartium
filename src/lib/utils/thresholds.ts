import type { Dayjs } from "dayjs";
import type { Chart, TraceInfo } from "../index.js";
import type { Color } from "./color.js";
import type { Quantity } from "../types.js";

export type ThresholdInfo = Omit<TraceInfo, "xDataUnit" | "yDataUnit"> & {
  y: number | Quantity | Dayjs;
};
export const defaultThresholdStyle = {
  color: [255, 255, 255] as Color,
  display: "line" as "line" | "points",
  width: 1,
};

export function createThreshold(y: number | Quantity | Dayjs): ThresholdInfo {
  return {
    y,
    ...defaultThresholdStyle,
    id: Math.random().toString(),
    label: "Threshold",
  };
}
