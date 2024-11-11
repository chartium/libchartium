import { todo, yeet } from "@typek/typek";
import {
  toNumeric,
  type ChartValue,
  type ComputedTraceStyle,
  type StatsTable,
} from "../mod.js";
import { measureText } from "../utils/format.js";
const DEG = Math.PI / 180;

interface Extents {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

interface Label extends Extents {
  variant: {
    startDeg: number;
    midpointDeg: number;
    endDeg: number;
    id: string;
    label: string | undefined;
    style: ComputedTraceStyle;
    value: number;
    quantity: (ChartValue | undefined) & ChartValue;
    offset: number;
  };
}

interface LabelLayout {
  extents: Extents | null;
  radius: number;
  done: boolean;
  labels: Label[];
}

const getPieVariants = (table: StatsTable<any>, statTitle: string) => {
  const stat =
    table.stats().find((s) => s.statTitle === statTitle) ??
    yeet(
      `Stat "${statTitle}" not found among stats "${table.stats().map((s) => s.statTitle)}"`,
    );

  if (stat.type === "custom") {
    yeet(`Pie charts from custom stats are not supported.`);
  }

  let sum = 0;
  const offsetVariants = stat.variants
    .filter((v): v is typeof v & { value: ChartValue } => v.value !== undefined)
    .map((v) => {
      const value = toNumeric(v.value, stat.dataUnit);
      const offset = sum;
      sum += value;
      return {
        id: v.variantId,
        label: table.getLabel(v.variantId),
        style: v.style,
        value,
        quantity: v.value,
        offset,
      };
    })
    .map((v) => {
      const VALUE_TO_DEG = 360 / sum;
      const startDeg = v.offset * VALUE_TO_DEG;
      const endDeg = (v.offset + v.value) * VALUE_TO_DEG;
      return {
        ...v,
        startDeg,
        endDeg,
        midpointDeg: startDeg + (endDeg - startDeg) / 2,
      };
    });

  // Rotate the chart so that the first label is at 45°
  const firstMidpointDeg = offsetVariants[0]?.midpointDeg ?? 0;
  const offsetDeg = 45 - firstMidpointDeg;
  const variants = offsetVariants.map((v) => ({
    ...v,
    startDeg: v.startDeg + offsetDeg,
    midpointDeg: v.midpointDeg + offsetDeg,
    endDeg: v.endDeg + offsetDeg,
  }));

  const { dataUnit, statStyle, unit } = stat;

  return { statTitle, statStyle, dataUnit, unit, variants };
};

const toExtents = (
  mapCoord: (x: number, y: number) => [x: number, y: number],
  [x1, y1, x2, y2]: [
    x_min: number,
    y_min: number,
    x_max: number,
    y_max: number,
  ],
): Extents => {
  const [x1m, y1m] = mapCoord(x1, y1);
  const [x2m, y2m] = mapCoord(x2, y2);

  return {
    x_min: Math.min(x1m, x2m),
    y_min: Math.min(y1m, y2m),
    x_max: Math.max(x1m, x2m),
    y_max: Math.max(y1m, y2m),
  };
};

const withExtents = <
  T extends {
    labels: Array<{
      x_min: number;
      y_min: number;
      x_max: number;
      y_max: number;
    }>;
  },
>(
  x: T,
): T & { extents: Extents | null } => ({
  ...x,
  extents:
    x.labels.length === 0
      ? null
      : x.labels.reduce<Extents>(
          (prev, curr) => ({
            x_min: Math.min(prev.x_min, curr.x_min),
            x_max: Math.max(prev.x_max, curr.x_max),
            y_min: Math.min(prev.y_min, curr.y_min),
            y_max: Math.max(prev.y_max, curr.y_max),
          }),
          {
            x_min: Infinity,
            x_max: -Infinity,
            y_min: Infinity,
            y_max: -Infinity,
          },
        ),
});

const layoutVerticalOctant = ({
  radius,
  variants,
  measureLabel,
  reverse,
  filterAngle,
  mapAngle,
  mapCoord,
}: {
  radius: number;
  variants: ReturnType<typeof getPieVariants>["variants"];
  measureLabel: (variant: (typeof variants)[number]) => {
    width: number;
    height: number;
  };
  reverse: boolean;
  filterAngle: (deg: number) => boolean;
  mapAngle: (deg: number) => number;
  mapCoord: (x: number, y: number) => [x: number, y: number];
  limits: Extents;
}): LabelLayout => {
  if (reverse) variants = variants.toReversed();

  const labels: Array<
    Extents & {
      variant: (typeof variants)[number];
    }
  > = [];

  let maxAngle = 0;
  let yAtMaxAngle = 0;
  let minRadius = radius;

  for (const variant of variants) {
    const { midpointDeg: originalMidpointDeg } = variant;
    if (!filterAngle(originalMidpointDeg)) continue;
    console.log(variant.id);

    const midpointDeg = mapAngle(originalMidpointDeg);
    const { width, height } = measureLabel(variant);

    //
    // Will lay at edge
    if (midpointDeg > maxAngle) {
      const x = radius * Math.tan(midpointDeg * DEG);

      labels.push({
        variant,
        ...toExtents(mapCoord, [x, 0, x + width, height]),
      });
      maxAngle = Math.atan((x + width) / (radius - height)) / DEG;
      yAtMaxAngle = height;

      minRadius = Math.min(minRadius, Math.hypot(x, radius - height));

      //
      // Will lay below another label
    } else {
      const x = (radius - yAtMaxAngle) * Math.tan(midpointDeg * DEG);
      labels.push({
        variant,
        ...toExtents(mapCoord, [
          x,
          yAtMaxAngle,
          x + width,
          yAtMaxAngle + height,
        ]),
      });
      const thisAngle =
        Math.atan((x + width) / (radius - yAtMaxAngle - yAtMaxAngle - height)) /
        DEG;
      if (thisAngle > maxAngle) {
        maxAngle = thisAngle;
        yAtMaxAngle = yAtMaxAngle + height;
      }

      minRadius = Math.min(
        minRadius,
        Math.hypot(x, radius - yAtMaxAngle - height),
      );
    }
  }

  if (reverse) labels.reverse();
  return withExtents({ labels, done: false, radius: minRadius });
};

const layoutHorizontalOctant = ({
  radius,
  variants,
  measureLabel,
  reverse,
  filterAngle,
  mapAngle,
  mapCoord,
  limits,
}: {
  radius: number;
  variants: ReturnType<typeof getPieVariants>["variants"];
  measureLabel: (variant: (typeof variants)[number]) => {
    width: number;
    height: number;
  };
  reverse: boolean;
  filterAngle: (deg: number) => boolean;
  mapAngle: (deg: number) => number;
  mapCoord: (x: number, y: number) => [x: number, y: number];
  limits: Extents;
}): LabelLayout => {
  if (variants.length === 0)
    return {
      labels: [],
      done: false,
      radius,
      extents: null,
    };
  if (reverse) variants = variants.toReversed();

  const labels: Array<
    Extents & {
      variant: (typeof variants)[number];
    }
  > = [];

  let y = limits.y_min + measureLabel(variants[0]).height / 2;

  for (const variant of variants) {
    const { midpointDeg: originalMidpointDeg } = variant;
    if (!filterAngle(originalMidpointDeg)) continue;

    const midpointDeg = mapAngle(originalMidpointDeg);
    const { width, height } = measureLabel(variant);

    const natural_y = radius * Math.sin(midpointDeg * DEG) - height / 2;
    if (natural_y > y) y = natural_y;

    labels.push({
      variant,
      ...toExtents(mapCoord, [-width, y, 0, y + height]),
    });

    y = y + height;
  }

  if (reverse) labels.reverse();
  return withExtents({ labels, done: false, radius });
};

const degToOctant = (deg: number) => {
  if (deg < 45) return 1;
  if (deg >= 45 && deg <= 90) return 2;
  if (deg > 90 && deg <= 135) return 3;
  if (deg > 135 && deg <= 180) return 4;
  if (deg > 180 && deg <= 225) return 5;
  if (deg > 225 && deg <= 270) return 6;
  if (deg > 270 && deg <= 315) return 7;
  return 8;
};

const layoutNthOctant = ({
  octant,
  width,
  height,
  prevExtents,
  ...props
}: {
  octant: number;
  width: number;
  height: number;

  radius: number;
  variants: ReturnType<typeof getPieVariants>["variants"];
  measureLabel: (variant: (typeof props.variants)[number]) => {
    width: number;
    height: number;
  };
  prevExtents: Extents | null;
}) => {
  const filterAngle = (deg: number) => degToOctant(deg) === octant;

  switch (octant) {
    case 1:
      return layoutVerticalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => deg,
        mapCoord: (x, y) => [x, y - props.radius],
        reverse: false,
        limits: {
          x_min: 0,
          x_max: width / 2,
          y_min: -height / 2,
          y_max: 0,
        },
      });
    case 2:
      return layoutHorizontalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => 90 - deg,
        mapCoord: (x, y) => [x + width / 2, -y],
        reverse: true,
        limits: {
          x_min: 0,
          x_max: width / 2,
          y_min: prevExtents?.y_max ?? -height / 2,
          y_max: height / 2,
        },
      });
    case 3:
      return layoutHorizontalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => deg - 90,
        mapCoord: (x, y) => [x + width / 2, y],
        reverse: false,
        limits: {
          x_min: 0,
          x_max: width / 2,
          y_min: prevExtents?.y_max ?? -height / 2,
          y_max: height / 2,
        },
      });
    case 4:
      return layoutVerticalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => -deg + 180,
        mapCoord: (x, y) => [x, -y + height / 2],
        reverse: true,
        limits: {
          x_min: -width / 2,
          x_max: width / 2,
          y_min: 0,
          y_max: height / 2,
        },
      });
    case 5:
      return layoutVerticalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => deg - 180,
        mapCoord: (x, y) => [-x, -y + props.radius],
        reverse: false,
        limits: {
          x_min: -width / 2,
          x_max: width / 2,
          y_min: 0,
          y_max: height / 2,
        },
      });
    case 6:
      return layoutHorizontalOctant({
        ...props,
        filterAngle,
        mapAngle: (deg) => 270 - deg,
        mapCoord: (x, y) => [-x - width / 2, y],
        reverse: true,
        limits: {
          x_min: -width / 2,
          x_max: 0,
          y_min: -height / 2,
          y_max: height / 2,
        },
      });
    case 7:
    case 8:
      throw todo();
    default:
      throw Error(`Octant must be an integer from 1 to 8, got: ${octant}`);
  }
};

export const layoutPieChart = ({
  width,
  height,
  table,
  statTitle,
}: {
  width: number;
  height: number;
  table: StatsTable<any>;
  statTitle: string;
}) => {
  const { variants } = getPieVariants(table, statTitle);
  const radius = height / 2;

  const measureLabel = (
    variant: ReturnType<typeof getPieVariants>["variants"][number],
  ) => measureText(variant.label ?? variant.id, document.body);

  const labels: ReturnType<typeof layoutVerticalOctant>["labels"] = [];
  let smallRadius = radius;
  let prevExtents: Extents | null = null;

  // starting from the second octant (ie. offset by 45° cw)
  for (const octant of [2, 3, 4, 5, /* 6, 7, 8, */ 1]) {
    const {
      done,
      labels: newLabels,
      radius: newRadius,
      extents,
    } = layoutNthOctant({
      octant,
      height,
      width,
      radius,
      measureLabel,
      variants,
      prevExtents,
    });
    labels.push(...newLabels);
    smallRadius = Math.min(smallRadius, newRadius);
    prevExtents = extents;
    if (done) break;
  }

  return { labels, variants, radius: smallRadius };
};
