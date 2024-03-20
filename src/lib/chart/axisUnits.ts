import { cons, derived, mutDerived, type Signal } from "@mod.js/signals";
import type { FactorDefinition } from "unitlib";
import Fraction from "fraction.js";

import { NumericDateFormat, TraceList } from "../index.js";
import { Quantity, type Range, type Unit } from "../types.js";
import { mapOpt } from "../utils/mapOpt.js";

import type {
  DataUnit,
  DisplayUnit,
  DisplayUnitPreference,
  UnitChangeAction,
} from "./axis.js";

export interface AxisUnitsProps {
  axis: "x" | "y";
  visibleTraces$: Signal<TraceList>;
  range$: Signal<Range>;
  displayUnitPreference$: Signal<DisplayUnitPreference>;
}

export interface AxisUnits {
  currentDisplayUnit$: Signal<DisplayUnit>;
  unitChangeActions$: Signal<{
    raise?: UnitChangeAction;
    reset?: UnitChangeAction;
    lower?: UnitChangeAction;
  }>;
}

export const axisUnits$ = ({
  axis,
  visibleTraces$,
  range$,
  displayUnitPreference$,
}: AxisUnitsProps): AxisUnits => {
  const dataUnit$ = derived(
    ($) => $(visibleTraces$).getUnits()?.[0][axis],
  ).skipEqual();

  const defaultDisplayUnit$ = createDefaultUnit$(
    dataUnit$,
    displayUnitPreference$,
    range$,
  );

  const { currentDisplayUnit$, resetDisplayUnit, setDisplayUnit } =
    createCurrentUnit$({
      dataUnit$,
      defaultDisplayUnit$,
    });

  const unitChangeActions$ = (true as boolean)
    ? cons({})
    : createUnitChangeActions$({
        defaultDisplayUnit$,
        currentDisplayUnit$,
        resetDisplayUnit,
        setDisplayUnit,
      });

  return {
    currentDisplayUnit$: currentDisplayUnit$.tap((u) =>
      console.log("CURRENT DISPLAY UNIT!", axis, u),
    ),
    unitChangeActions$,
  };
};

const createDefaultUnit$ = (
  dataUnit$: Signal<DataUnit>,
  displayUnitPreference$: Signal<DisplayUnitPreference>,
  range$: Signal<Range>,
) =>
  derived(($): DisplayUnit => {
    const pref = $(displayUnitPreference$);
    const dat = $(dataUnit$);
    switch (pref) {
      case "data":
        return dataUnitToDisplayUnit(dat);

      case "auto":
        return $(bestDisplayUnit(dataUnit$, range$));

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

    const reset = mapOpt(
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
          if (reset?.unit.isEqual(unit)) return;
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
  if (!dataUnit || dataUnit instanceof NumericDateFormat)
    return displayUnit === undefined;
  try {
    new Quantity(1, dataUnit).inUnits(displayUnit!);
    return true;
  } catch {
    return false;
  }
};

const dataUnitToDisplayUnit = (u: DataUnit): DisplayUnit =>
  u instanceof NumericDateFormat ? undefined : u;

// TODO
const bestDisplayUnit = (dataUnit: Signal<DataUnit>, _range: Signal<Range>) =>
  derived(($): DisplayUnit => {
    return dataUnitToDisplayUnit($(dataUnit));
  });

const changeFactor = ({
  direction,
  currentUnit,
}: {
  direction: "raise" | "lower";
  currentUnit: DisplayUnit;
}): Unit | undefined => {
  // NOTE changing the factor of a date range is not supported
  if (!currentUnit || currentUnit instanceof NumericDateFormat) return;

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
