import type { Dayjs } from "dayjs";
import type {
  Chart,
  ChartiumController,
  NumericDateFormat,
  TraceInfo,
  TraceStyle,
} from "../index.js";
import type { Color } from "./color.js";
import type { ExportRow, Quantity, Range, Unit } from "../types.js";
import type { WritableSignal } from "@mod.js/signals";
import { TraceList } from "../index.js";
import { map } from "../utils/collection.js";
import { toNumeric } from "./quantityHelpers.js";
import type { Remote } from "comlink";

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

export async function getUpdatedThresholds(
  newRange: Range,
  xUnit: NumericDateFormat | Unit | undefined,
  controller: ChartiumController | Remote<ChartiumController>,
  oldThresholds: TraceList,
) {
  if (oldThresholds.traceCount === 0) return oldThresholds;

  const thresholdYs: Set<{ id: string; y: number }> = new Set();
  const writer = {
    ready: Promise.resolve(undefined),
    write: (a: any) => {
      return Promise.resolve();
    },
  };
  const transformer = (row: ExportRow) => {
    Object.entries(row)
      .map(([id, y]) => ({ id, y }))
      .map((entry) => thresholdYs.add(entry));
    return "lick my balls";
  };

  oldThresholds.exportData({
    transformer,
    writer,
    range: oldThresholds.range,
  });

  const newThresholds = await controller.addFromColumnarArrayBuffers({
    x: {
      type: "f32",
      data: Uint8Array.from([
        toNumeric(newRange.from, xUnit),
        toNumeric(newRange.to, xUnit),
      ]),
    },
    y: {
      type: "f32",
      columns: Array.from(thresholdYs).map(({ id, y }) => ({
        id,
        data: Uint8Array.from([y]),
      })),
    },
  });

  return newThresholds;
}
