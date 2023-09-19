import type { Range, Tick, Unit } from "../lib/types";

const boxes: number[] = [1, 2, 5, 10];

export const linearTicks = (
  { from, to }: Range,
  dataUnit: Unit | undefined,
  displayUnit: Unit | undefined
): Tick[] => {
  const width = to - from;
  let firstTick: number = 0.0;
  let ticksDist: number = 1.0;

  {
    let order = Math.floor(Math.log10(width)) - 1;

    for (const size of boxes) {
      ticksDist = Math.pow(10, order) * size;
      firstTick = Math.floor(from / ticksDist) * ticksDist;

      if ((to - firstTick) / ticksDist < 10) {
        break;
      }
    }
  }

  const result: Tick[] = [];
  const factor = dataUnit ? displayUnit?.divide(dataUnit) : undefined;

  for (let i = 1; i <= Math.floor((to - firstTick) / ticksDist); ++i) {
    const value = firstTick + ticksDist * i;
    result.push({
      value: factor ? factor.multiplyValueByFactor(value) : value,
      position: (firstTick + ticksDist * i - from) / width,
      unit: factor ? displayUnit : undefined,
    });
  }

  return result;
};
