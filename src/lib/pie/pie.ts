import { yeet } from "@typek/typek";
import { toNumeric, type ChartValue, type StatsTable } from "../mod.js";
import { measureText } from "../utils/format.js";
const DEG = Math.PI / 180;

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
  const variants = stat.variants
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

  const { dataUnit, statStyle, unit } = stat;

  return { statTitle, statStyle, dataUnit, unit, variants };
};

const toLayout = (
  mapCoord: (x: number, y: number) => [x: number, y: number],
  [x1, y1, x2, y2]: [
    x_min: number,
    y_min: number,
    x_max: number,
    y_max: number,
  ],
) => {
  const [x1m, y1m] = mapCoord(x1, y1);
  const [x2m, y2m] = mapCoord(x2, y2);

  return {
    x_min: Math.min(x1m, x2m),
    y_min: Math.min(y1m, y2m),
    x_max: Math.max(x1m, x2m),
    y_max: Math.max(y1m, y2m),
  };
};

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
}) => {
  if (reverse) variants = variants.toReversed();

  const labels: {
    variant: (typeof variants)[number];
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  }[] = [];

  let maxAngle = 0;
  let yAtMaxAngle = 0;
  let minRadius = radius;

  for (const variant of variants) {
    const { midpointDeg: originalMidpointDeg } = variant;
    if (!filterAngle(originalMidpointDeg)) continue;

    const midpointDeg = mapAngle(originalMidpointDeg);
    const { width, height } = measureLabel(variant);

    //
    // Will lay at edge
    if (midpointDeg > maxAngle) {
      const x = radius * Math.tan(midpointDeg * DEG);

      labels.push({
        variant,
        ...toLayout(mapCoord, [x, 0, x + width, height]),
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
        ...toLayout(mapCoord, [
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

      minRadius = Math.min(minRadius, Math.hypot(x, radius - height));
    }
  }

  if (reverse) labels.reverse();
  return { labels, done: false, radius: minRadius };
};

const layoutHorizontalOctant = ({
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
}) => {
  if (variants.length === 0) return { labels: [], done: false, radius };
  if (reverse) variants = variants.toReversed();

  const labels: {
    variant: (typeof variants)[number];
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  }[] = [];

  let y = measureLabel(variants[0]).height / 2;

  for (const variant of variants) {
    const { midpointDeg: originalMidpointDeg } = variant;
    if (!filterAngle(originalMidpointDeg)) continue;

    const midpointDeg = mapAngle(originalMidpointDeg);
    const { width, height } = measureLabel(variant);

    const natural_y = radius * Math.sin(midpointDeg * DEG) - height / 2;
    if (natural_y > y) y = natural_y;

    labels.push({
      variant,
      ...toLayout(mapCoord, [-width, y, 0, y + height]),
    });

    y = y + height;
  }

  if (reverse) labels.reverse();
  return { labels, done: false, radius };
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
  let done = false;
  let smallRadius = radius;

  // 1st octant
  {
    const l = layoutVerticalOctant({
      radius,
      measureLabel,
      variants,
      filterAngle: (deg) => deg <= 45,
      mapAngle: (deg) => deg,
      mapCoord: (x, y) => [x, y - radius],
      reverse: false,
    });
    labels.push(...l.labels);
    done = l.done;
    smallRadius = Math.min(smallRadius, l.radius);
  }

  // 2nd octant
  if (!done) {
    const l = layoutHorizontalOctant({
      radius,
      measureLabel,
      variants,
      filterAngle: (deg) => deg > 45 && deg <= 90,
      mapAngle: (deg) => 90 - deg,
      mapCoord: (x, y) => [x + width / 2, -y],
      reverse: true,
    });
    labels.push(...l.labels);
    done = l.done;
    smallRadius = Math.min(smallRadius, l.radius);
  }

  // 3rd octant
  if (!done) {
    const l = layoutHorizontalOctant({
      radius,
      measureLabel,
      variants,
      filterAngle: (deg) => deg > 90 && deg <= 135,
      mapAngle: (deg) => deg - 90,
      mapCoord: (x, y) => [x + width / 2, y],
      reverse: false,
    });
    labels.push(...l.labels);
    done = l.done;
    smallRadius = Math.min(smallRadius, l.radius);
  }

  // 4th octant
  if (!done) {
    const l = layoutVerticalOctant({
      radius,
      measureLabel,
      variants,
      filterAngle: (deg) => deg > 135 && deg <= 180,
      mapAngle: (deg) => -deg + 180,
      mapCoord: (x, y) => [x, -y + height / 2],
      reverse: true,
    });
    labels.push(...l.labels);
    done = l.done;
    smallRadius = Math.min(smallRadius, l.radius);
  }

  return { labels, variants, radius: smallRadius };
};
