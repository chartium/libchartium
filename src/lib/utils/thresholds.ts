import type { Dayjs } from "dayjs";
import type { Chart, TraceInfo, TraceStyle } from "../index.js";
import type { Color } from "./color.js";
import type { Quantity } from "../types.js";

export type ThresholdInfo = Omit<TraceInfo, "xDataUnit" | "yDataUnit"> & {
  y: number | Quantity | Dayjs;
};
export const defaultThresholdStyle = {
  color: [255, 255, 255] as Color,
  traceMode: {
    dashLength: 10,
    gapLength: 10,
  },
  showPoints: false,
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
