import type { Signal } from "@mod.js/signals";
import type { ChartValue, Range, Size } from "../types.js";
import { toNumeric, toChartValue } from "../utils/unit.js";
import { unitOf } from "./axisRange.js";

export interface ChartAffineSpaceProps {
  xRange$: Signal<Range>;
  yRange$: Signal<Range>;
  canvasLogicalSize$: Signal<Size | undefined>;
}

export interface ValueOnAxis {
  toFraction(): number;
  toClipSpace(): number;
  toPhysicalPixels(): number;
  toLogicalPixels(): number;
  toQuantity(): ChartValue;
}

export interface CoordinatesInChart {
  toFractions(): { x: number; y: number };
  toClipSpace(): { x: number; y: number };
  toPhysicalPixels(): { x: number; y: number };
  toLogicalPixels(): { x: number; y: number };
  toQuantitites(): { x: ChartValue; y: ChartValue };
}

export interface PointInChart extends CoordinatesInChart {
  vectorTo(another: PointInChart): VectorInChart;
}

export interface VectorInChart extends CoordinatesInChart {
  add(another: VectorInChart): VectorInChart;
  scale(number: number): VectorInChart;
  magnitudeInPhysicalPixels(): number;
  magnitudeInLogicalPixels(): number;
}

export interface ValueOnAxisFactory {
  fromFraction(value: number): ValueOnAxis;
  fromClipSpace(value: number): ValueOnAxis;
  fromPhysicalPixels(value: number): ValueOnAxis;
  fromLogicalPixels(value: number): ValueOnAxis;
  fromQuantity(value: ChartValue): ValueOnAxis;
}

export interface PointInChartFactory {
  fromFractions(x: number, y: number): PointInChart;
  fromClipSpace(x: number, y: number): PointInChart;
  fromPhysicalPixels(x: number, y: number): PointInChart;
  fromLogicalPixels(x: number, y: number): PointInChart;
  fromQuantities(x: ChartValue, y: ChartValue): PointInChart;
}

export interface ChartAffineSpace {
  valueOnAxis(axis: "x" | "y"): ValueOnAxisFactory;
  point(): PointInChartFactory;
}

// TODO optimize implementation to allocate fewer objects

export const chartAffineSpace = ({
  canvasLogicalSize$: maybeCanvasLogicalSize$,
  xRange$,
  yRange$,
}: ChartAffineSpaceProps): ChartAffineSpace => {
  const canvasLogicalSize$ = maybeCanvasLogicalSize$.map(
    (s) => s ?? { width: NaN, height: NaN },
  );

  const valueOnAxis = (axis: "x" | "y") => {
    const logicalSize =
      canvasLogicalSize$.get()[axis === "x" ? "width" : "height"];

    const zoom = devicePixelRatio;
    const physicalSize = logicalSize * zoom;
    const range = (axis === "x" ? xRange$ : yRange$).get();
    const unit = unitOf(range.from);
    const from = toNumeric(range.from, unit);
    const to = toNumeric(range.to, unit);
    const length = to - from;

    const fromFraction = (v: number): ValueOnAxis => ({
      toFraction: () => v,
      toClipSpace: () => {
        const sign = axis === "y" ? -1 : 1;
        return sign * (2 * v - 1);
      },
      toPhysicalPixels: () => v * physicalSize,
      toLogicalPixels: () => v * logicalSize,
      toQuantity: () =>
        axis === "y"
          ? toChartValue(to - length * v, unit)
          : toChartValue(length * v + from, unit),
    });

    const fromClipSpace = (v: number) => {
      const sign = axis === "y" ? -1 : 1;
      return fromFraction((sign * (v + 1)) / 2);
    };

    const fromPhysicalPixels = (v: number) => fromFraction(v / physicalSize);
    const fromLogicalPixels = (v: number) => fromFraction(v / logicalSize);
    const fromQuantity = (v: ChartValue) =>
      axis === "y"
        ? fromFraction((to - toNumeric(v, unit)) / length)
        : fromFraction(1 - (to - toNumeric(v, unit)) / length);

    return {
      fromFraction,
      fromClipSpace,
      fromPhysicalPixels,
      fromLogicalPixels,
      fromQuantity,
    };
  };

  const point = (): PointInChartFactory => {
    const X = valueOnAxis("x");
    const Y = valueOnAxis("y");

    const fromFractions = (x: number, y: number) =>
      pointFromValues(X.fromFraction(x), Y.fromFraction(y));

    const fromClipSpace = (x: number, y: number) =>
      pointFromValues(X.fromClipSpace(x), Y.fromClipSpace(y));

    const fromPhysicalPixels = (x: number, y: number) =>
      pointFromValues(X.fromPhysicalPixels(x), Y.fromPhysicalPixels(y));

    const fromLogicalPixels = (x: number, y: number) =>
      pointFromValues(X.fromLogicalPixels(x), Y.fromLogicalPixels(y));

    const fromQuantities = (x: ChartValue, y: ChartValue) =>
      pointFromValues(X.fromQuantity(x), Y.fromQuantity(y));

    const coordsFromValues = (
      x: ValueOnAxis,
      y: ValueOnAxis,
    ): CoordinatesInChart => ({
      toFractions: () => ({ x: x.toFraction(), y: y.toFraction() }),
      toClipSpace: () => ({ x: x.toClipSpace(), y: y.toClipSpace() }),
      toPhysicalPixels: () => ({
        x: x.toPhysicalPixels(),
        y: y.toPhysicalPixels(),
      }),
      toLogicalPixels: () => ({
        x: x.toLogicalPixels(),
        y: y.toLogicalPixels(),
      }),
      toQuantitites: () => ({ x: x.toQuantity(), y: y.toQuantity() }),
    });

    const pointFromValues = (x: ValueOnAxis, y: ValueOnAxis): PointInChart => ({
      ...coordsFromValues(x, y),
      vectorTo: (p) =>
        vectorFromValues(
          X.fromFraction(p.toFractions().x - x.toFraction()),
          Y.fromFraction(p.toFractions().y - y.toFraction()),
        ),
    });

    const vectorFromValues = (
      x: ValueOnAxis,
      y: ValueOnAxis,
    ): VectorInChart => ({
      ...coordsFromValues(x, y),
      add: (v) =>
        vectorFromValues(
          X.fromFraction(v.toFractions().x + x.toFraction()),
          Y.fromFraction(v.toFractions().y + y.toFraction()),
        ),
      scale: (s) =>
        vectorFromValues(
          X.fromFraction(s * x.toFraction()),
          Y.fromFraction(s * y.toFraction()),
        ),
      magnitudeInPhysicalPixels: () =>
        Math.hypot(x.toPhysicalPixels(), y.toPhysicalPixels()),
      magnitudeInLogicalPixels: () =>
        Math.hypot(x.toLogicalPixels(), y.toLogicalPixels()),
    });

    return {
      fromFractions,
      fromClipSpace,
      fromPhysicalPixels,
      fromLogicalPixels,
      fromQuantities,
    };
  };

  return { valueOnAxis, point };
};
