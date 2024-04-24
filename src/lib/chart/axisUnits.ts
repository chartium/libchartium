import { derived, mutDerived, type Signal } from "@mod.js/signals";
import { isQuantity, isUnit, type FactorDefinition } from "unitlib";
import Fraction from "fraction.js";

import { TraceList } from "../index.js";
import {
  Quantity,
  type DisplayUnitPreference,
  type Range,
  type Unit,
  type DisplayUnit,
  type DataUnit,
} from "../types.js";
import { mapOpt } from "../utils/mapOpt.js";

import type { UnitChangeAction, UnitChangeActions } from "./axis.js";
import { eq } from "../utils/unit.js";
import { isNumericDateRepresentation } from "../utils/numericDateRepresentation.js";
import { DateFormat, isDateFormat } from "../utils/dateFormat.js";

export interface AxisUnitsProps {
  axis: "x" | "y";
  visibleTraces$: Signal<TraceList>;
  range$: Signal<Range>;
  displayUnitPreference$: Signal<DisplayUnitPreference>;
}

export interface AxisUnits {
  dataUnit$: Signal<DataUnit>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  unitChangeActions$: Signal<UnitChangeActions>;
}

export const axisUnits$ = ({
  axis,
  visibleTraces$,
  range$,
  displayUnitPreference$,
}: AxisUnitsProps): AxisUnits => {
  const dataUnit$ = derived(($) =>
    axis === "x" ? $(visibleTraces$).xDataUnit : $(visibleTraces$).yDataUnit,
  ).skipEqual();

  const bestUnit$ = bestDisplayUnit(dataUnit$, range$);
  const defaultDisplayUnit$ = createDefaultUnit$(
    dataUnit$,
    bestUnit$,
    displayUnitPreference$,
  );

  const { currentDisplayUnit$, resetDisplayUnit, setDisplayUnit } =
    createCurrentUnit$({
      dataUnit$,
      defaultDisplayUnit$,
    });

  const dataUnawareUnitActions$ = createUnitChangeActions$({
    defaultDisplayUnit$,
    currentDisplayUnit$,
    resetDisplayUnit,
    setDisplayUnit,
  });

  const unitBestFitAction$ = createUnitBestFitAction$({
    bestUnit$,
    currentDisplayUnit$,
    defaultDisplayUnit$,
    setDisplayUnit,
  });

  return {
    dataUnit$,
    currentDisplayUnit$,
    unitChangeActions$: derived(($) => {
      const unaware = $(dataUnawareUnitActions$);
      const bestFit = $(unitBestFitAction$);

      return {
        ...unaware,
        bestFit,
      };
    }),
  };
};

const createDefaultUnit$ = (
  dataUnit$: Signal<DataUnit>,
  bestUnit$: Signal<DisplayUnit>,
  displayUnitPreference$: Signal<DisplayUnitPreference>,
) => {
  return derived(($): DisplayUnit => {
    const pref = $(displayUnitPreference$);
    const dat = $(dataUnit$);
    switch (pref) {
      case "data":
        return dataUnitToDisplayUnit(dat);

      case "auto":
        return $(bestUnit$);

      default:
        if (isDisplayUnitValidForDataUnit(pref, dat)) {
          return pref;
        } else {
          console.warn(
            `The specified display unit "${displayUnitPreference$}" is invalid for the data unit "${dataUnit$}"`,
          );
          return dataUnitToDisplayUnit(dat);
        }
    }
  }).skipEqual();
};

const createCurrentUnit$ = ({
  dataUnit$,
  defaultDisplayUnit$,
}: {
  dataUnit$: Signal<DataUnit>;
  defaultDisplayUnit$: Signal<DisplayUnit>;
}) => {
  let isDefault = false;
  const current$ = mutDerived<DisplayUnit>(($, { prev }) => {
    const def = $(defaultDisplayUnit$);
    const dat = $(dataUnit$);

    if (!isDisplayUnitValidForDataUnit(prev, dat)) {
      isDefault = true;
    }

    if (isDefault) return def;
    return prev;
  });

  const resetDisplayUnit = () => {
    isDefault = true;
    current$.set(defaultDisplayUnit$.get());
  };

  const setDisplayUnit = (u: DisplayUnit) => current$.set(u);

  return {
    currentDisplayUnit$: current$.toReadonly(),
    resetDisplayUnit,
    setDisplayUnit,
  };
};

const createUnitBestFitAction$ = ({
  bestUnit$,
  currentDisplayUnit$,
  defaultDisplayUnit$,
  setDisplayUnit,
}: {
  bestUnit$: Signal<DisplayUnit>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  defaultDisplayUnit$: Signal<DisplayUnit>;
  setDisplayUnit: (u: DisplayUnit) => void;
}) =>
  derived(($): UnitChangeAction | undefined => {
    const unit = $(bestUnit$);
    const currUnit = $(currentDisplayUnit$);
    const defaultUnit = $(defaultDisplayUnit$);

    if (eq(unit, currUnit) || eq(unit, defaultUnit)) return undefined;

    return {
      unit,
      callback: () => setDisplayUnit(unit),
    };
  });

const createUnitChangeActions$ = ({
  defaultDisplayUnit$,
  currentDisplayUnit$,
  resetDisplayUnit,
  setDisplayUnit,
}: {
  defaultDisplayUnit$: Signal<DisplayUnit>;
  currentDisplayUnit$: Signal<DisplayUnit>;
  resetDisplayUnit: () => void;
  setDisplayUnit: (u: DisplayUnit) => void;
}) =>
  derived(($) => {
    const curr = $(currentDisplayUnit$);
    const def = $(defaultDisplayUnit$);

    const reset = eq(curr, def)
      ? undefined
      : mapOpt(
          def,
          (def): UnitChangeAction => ({
            unit: def,
            callback: resetDisplayUnit,
          }),
        );

    const [raise, lower] = (["raise", "lower"] as const).map((direction) =>
      mapOpt(
        changeFactor({ direction, currentUnit: curr }),
        (unit): UnitChangeAction | undefined => {
          // if raising/lowering should change to the same unit
          // as reseting, only show the reset action
          if (eq(reset?.unit, unit)) return;
          return {
            unit,
            callback: () => setDisplayUnit(unit),
          };
        },
      ),
    );

    return { raise, reset, lower };
  });

const isDisplayUnitValidForDataUnit = (
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

const dataUnitToDisplayUnit = (u: DataUnit): DisplayUnit =>
  isNumericDateRepresentation(u) ? new DateFormat() : u;

const bestDisplayUnit = (dataUnit$: Signal<DataUnit>, range$: Signal<Range>) =>
  derived(($): DisplayUnit => {
    let dataUnit = $(dataUnit$);
    const range = $(range$);

    if (isUnit(dataUnit)) {
      const { to } = range;

      if (typeof to === "number")
        dataUnit = (dataUnit as Unit).withBestFactorFor(to);
      else if (isQuantity(to))
        dataUnit = (dataUnit as Unit).withBestFactorFor((to as Quantity).value);
    }

    return dataUnitToDisplayUnit(dataUnit);
  }).skipEqual();

const changeFactor = ({
  direction,
  currentUnit,
}: {
  direction: "raise" | "lower";
  currentUnit: DisplayUnit;
}): Unit | undefined => {
  // NOTE changing the factor of a date range is not supported
  if (!currentUnit || isDateFormat(currentUnit)) return;

  const factorsEqual = (a: FactorDefinition, b: FactorDefinition) =>
    a.mul === b.mul && a.base === b.base && a.exp.equals(b.exp);

  const factors = Object.entries<FactorDefinition>(
    currentUnit.unitSystem.factors,
  );

  // add prefix-less factor
  factors.push(["(unitless)", { mul: 1, base: 1, exp: new Fraction(1) }]);

  // if the current factor is non-standard, add it to the list
  if (!factors.find(([_, f]) => factorsEqual(currentUnit.factor, f))) {
    factors.push(["(current)", currentUnit.factor]);
  }

  // sort by value
  factors.sort(
    ([_, a], [__, b]) => a.mul * a.base ** +a.exp - b.mul * b.base ** +b.exp,
  );

  const currentIndex = factors.findIndex(([_, f]) =>
    factorsEqual(currentUnit.factor, f),
  );

  const newIndex = currentIndex + (direction === "raise" ? 1 : -1);
  if (newIndex < 0 || newIndex >= factors.length) return;

  const newFactor = factors[newIndex][1];
  const newUnit = currentUnit.withFactor(newFactor);

  return newUnit;
};
