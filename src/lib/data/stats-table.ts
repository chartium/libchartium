import type {
  ChartRange,
  ChartValue,
  DataUnit,
  DisplayUnit,
  DisplayUnitPreference,
  VariantHandle,
  VariantHandleArray,
} from "../types.js";
import { registerNewVariantHandle, variantIds } from "./variant-ids.js";
import {
  CONSTRUCTOR,
  PARAMS,
  randomUint,
  type ComputedTraceStyle,
} from "./trace-list.js";
import { lib } from "../wasm.js";
import { UnknownVariantHandleError, UnknownVariantIdError } from "../errors.js";
import { resolvedColorToHex } from "../utils/color.js";
import { oxidizeStyleSheet, type TraceStyleSheet } from "./trace-styles.js";
import {
  toChartValue,
  maxValue,
  minValue,
  computeDefaultUnit,
  formatChartValue,
} from "../units/mod.js";
import {
  assertNever,
  concat,
  enumerate,
  filter,
  flatMap,
  fold,
  map,
  pipe,
  unique,
  yeet,
  zip,
} from "@typek/typek";
import { StatsTableExport } from "./data-export.js";

export interface StatStyle {
  template?: string;
  collapseGroup?: boolean;
}

export type StatSortingStrategy = {
  direction: "asc" | "desc";
  by: "lexicallyByTitle";
};

export type VariantSortingStrategy = {
  direction: "asc" | "desc";
  by: { valueOfStat: string } | "lexicallyById";
};

/** How the data is stored internally */
type StatData<CustomData> = {
  title: string;
  group: string | undefined;
  style: StatStyle;
} & (
  | {
      type: "value";
      dataUnit: DataUnit;
      displayUnit: DisplayUnitPreference;
      data: Map<VariantHandle, number>;
    }
  | {
      type: "custom";
      data: Map<VariantHandle, CustomData>;
    }
);

export interface Variant<CustomData> {
  variantId: string;
  style: ComputedTraceStyle;
  stats: Array<
    {
      statTitle: string;
      statGroup: string | undefined;
      statStyle: StatStyle;
    } & (
      | {
          type: "value";
          value: ChartValue | undefined;
          formattedValue: string | undefined;
        }
      | {
          type: "custom";
          value: CustomData | undefined;
        }
    )
  >;
}

export type Stat<CustomData = never> = {
  statTitle: string;
  statGroup: string | undefined;
  statStyle: StatStyle;
} & (
  | {
      type: "value";
      dataUnit: DataUnit;
      unit: DisplayUnit;
      variants: Array<{
        variantId: string;
        value: ChartValue | undefined;
        formattedValue: string | undefined;
        style: ComputedTraceStyle;
      }>;
    }
  | {
      type: "custom";
      variants: Array<{
        variantId: string;
        value: CustomData | undefined;
        style: ComputedTraceStyle;
      }>;
    }
);

type Merge<StatsTables extends StatsTable<any>[]> = StatsTable<
  StatsTables extends []
    ? Record<string, never>
    : StatsTables extends [
          StatsTable<infer Head>,
          ...infer Tail extends StatsTable<any>[],
        ]
      ? Head | Merge<Tail>
      : StatsTables extends StatsTable<infer T>[]
        ? T
        : never
>;

export interface StatsTableParams<CustomData> {
  handles: VariantHandleArray;
  stats: StatData<CustomData>[];

  labels: ReadonlyMap<string, string>;
  variantStyles: lib.TraceStyleSheet;
  precomputedColorIndices: lib.ResolvedColorIndices | undefined;

  randomSeed: number;
}

export class StatsTable<CustomData = never> {
  #p: Readonly<StatsTableParams<CustomData>>;
  private constructor(params: StatsTableParams<CustomData>) {
    this.#p = params;
  }
  get [PARAMS]() {
    return this.#p;
  }
  static [CONSTRUCTOR]<T>(params: StatsTableParams<T>) {
    return new StatsTable(params);
  }

  static empty(): StatsTable<Record<string, never>> {
    return new StatsTable({
      handles: new Uint32Array([]),
      stats: [],
      labels: new Map(),
      variantStyles: lib.TraceStyleSheet.unset(),
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  static fromSingleStat(opts: {
    statTitle: string;
    statGroup?: string;
    dataUnit?: DataUnit;
    displayUnit?: DisplayUnitPreference;
    ids: string[];
    values: number[];
    variantStyle?: TraceStyleSheet;
    statStyle?: StatStyle;
    labels?: Iterable<[string, string | undefined]>;
  }): StatsTable<never>;

  static fromSingleStat<CustomData>(opts: {
    statTitle: string;
    statGroup?: string;
    ids: string[];
    customData: CustomData[];
    variantStyle?: TraceStyleSheet;
    statStyle?: StatStyle;
    labels?: Iterable<[string, string | undefined]>;
  }): StatsTable<CustomData>;

  static fromSingleStat<Title extends string>({
    statTitle,
    statGroup,
    dataUnit,
    displayUnit,
    ids,
    values,
    customData,
    variantStyle,
    statStyle,
    labels,
  }: {
    statTitle: Title;
    statGroup?: string;
    dataUnit?: DataUnit;
    displayUnit?: DisplayUnitPreference;
    ids: string[];
    values?: number[];
    customData?: any[];
    variantStyle?: TraceStyleSheet;
    statStyle?: StatStyle;
    labels?: Iterable<[string, string | undefined]>;
  }): StatsTable<any> {
    const handles: VariantHandleArray = new Uint32Array(ids.length);

    statStyle ??= {};

    for (const [i, id] of enumerate(ids)) {
      handles[i] = variantIds.getKey(id) ?? registerNewVariantHandle(id);
    }

    return new StatsTable({
      handles,
      labels: new Map(
        filter(
          labels ?? [],
          (kv): kv is [string, string] => kv[1] !== undefined,
        ),
      ),
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
      variantStyles: oxidizeStyleSheet(variantStyle),
      stats: [
        values
          ? {
              type: "value",
              title: statTitle,
              group: statGroup,
              dataUnit,
              displayUnit: displayUnit ?? "auto",
              data: new Map(zip(handles, values)),
              style: statStyle,
            }
          : {
              type: "custom",
              title: statTitle,
              group: statGroup,
              data: new Map(zip(handles, customData!)),
              style: statStyle,
            },
      ],
    });
  }

  variantEntries(): Variant<CustomData>[] {
    return [...this.iterateVariantEntries()];
  }

  *iterateVariantEntries(): Iterable<Variant<CustomData>> {
    const ranges = this.#p.stats.map((stat) => {
      if ("dataUnit" in stat) {
        const { data, dataUnit } = stat;
        return pipe(
          data.values(),
          (values) => map(values, (v) => toChartValue(v, dataUnit)),
          (values) =>
            fold<ChartValue, { from?: ChartValue; to?: ChartValue }>(
              values,
              ({ from: min, to: max }, v) => ({
                from: min ? minValue(min, v) : v,
                to: max ? maxValue(max, v) : v,
              }),
              {},
            ),
          (range) => range as ChartRange,
        );
      }
    });

    for (const handle of this.#p.handles) {
      const variantId =
        variantIds.get(handle) ?? yeet(UnknownVariantHandleError, handle);
      const style = this.getStyle(variantId);

      const stats: Variant<CustomData>["stats"] = pipe(
        zip(this.#p.stats, ranges),
        (it) =>
          map(it, ([stat, range]): Variant<CustomData>["stats"][number] => {
            if ("dataUnit" in stat) {
              const { title, group, style, data, dataUnit, displayUnit } = stat;
              const unit = computeDefaultUnit(dataUnit, displayUnit, range!);
              const value = data.has(handle)
                ? toChartValue(data.get(handle)!, dataUnit)
                : undefined;

              const formattedValue = value
                ? formatChartValue(value, { unit })
                : undefined;

              return {
                type: "value",
                statTitle: title,
                statGroup: group,
                statStyle: style,
                value,
                formattedValue,
              };
            } else {
              return {
                type: "custom",
                statTitle: stat.title,
                statGroup: stat.group,
                statStyle: stat.style,
                value: stat.data.get(handle),
              };
            }
          }),
        (it) => [...it],
      );

      yield {
        variantId,
        style,
        stats,
      };
    }
  }

  statEntries(): Stat<CustomData>[] {
    return [...this.iterateStatEntries()];
  }

  *iterateStatEntries(): Iterable<Stat<CustomData>> {
    const ranges = new Map(
      this.#p.stats
        .filter((stat) => "dataUnit" in stat)
        .map((stat) =>
          pipe(
            stat.data.values(),
            (values) => map(values, (v) => toChartValue(v, stat.dataUnit)),
            (values) =>
              fold<ChartValue, { from?: ChartValue; to?: ChartValue }>(
                values,
                ({ from: min, to: max }, v) => ({
                  from: min ? minValue(min, v) : v,
                  to: max ? maxValue(max, v) : v,
                }),
                {},
              ),
            (range) => [stat, range as ChartRange],
          ),
        ),
    );

    for (const stat of this.#p.stats) {
      if (stat.type === "value") {
        const range = ranges.get(stat)!;
        const { displayUnit, dataUnit, data, title } = stat;
        const unit = computeDefaultUnit(dataUnit, displayUnit, range);
        const statTitle = title;

        const variants: Stat["variants"] = pipe(
          map(this.#p.handles, (h) => {
            const variantId =
              variantIds.get(h) ?? yeet(UnknownVariantHandleError, h);
            const style = this.getStyle(variantId);
            const value = data.has(h)
              ? toChartValue(data.get(h)!, dataUnit)
              : undefined;

            const formattedValue = value
              ? formatChartValue(value, { unit })
              : undefined;

            return {
              variantId,
              style,
              value,
              formattedValue,
            };
          }),
          (it) => [...it],
        );

        yield {
          type: "value",
          statTitle,
          statGroup: stat.group,
          statStyle: stat.style,
          dataUnit,
          unit,
          variants,
        };
      } else {
        const { title, data } = stat;
        yield {
          type: "custom",
          statTitle: title,
          statGroup: stat.group,
          statStyle: stat.style,
          variants: pipe(
            map(this.#p.handles, (h) => data.get(h)),
            Array.from<any>,
          ),
        };
      }
    }
  }

  get variantCount(): number {
    return this.#p.handles.length;
  }

  get statCount(): number {
    return this.#p.stats.length;
  }

  get randomSeed(): number {
    return this.#p.randomSeed;
  }

  #colorIndices_: lib.ResolvedColorIndices | undefined;
  get #colorIndices(): lib.ResolvedColorIndices {
    return (
      this.#colorIndices_ ??
      (this.#colorIndices_ =
        this.#p.precomputedColorIndices ??
        lib.ResolvedColorIndices.compute(
          this.#p.variantStyles,
          this.#p.handles,
        ))
    );
  }

  withLabels(newLabels: Iterable<[string, string | undefined]>) {
    const labels = new Map([
      ...this.#p.labels,
      ...filter(newLabels, (kv): kv is [string, string] => kv[1] !== undefined),
    ]);

    return new StatsTable({
      ...this.#p,
      labels,
    });
  }

  getLabel(variantId: string): string | undefined {
    return this.#p.labels.get(variantId);
  }

  getColor(variantId: string): `#${string}` {
    return resolvedColorToHex(
      this.#p.variantStyles.get_color(
        variantIds.getKey(variantId) ?? yeet(UnknownVariantIdError, variantId),
        this.#colorIndices,
        this.#p.randomSeed,
      ),
    );
  }

  getStyle(variantId: string): ComputedTraceStyle {
    const style = this.#p.variantStyles.get_computed(
      variantIds.getKey(variantId) ?? yeet(UnknownVariantIdError, variantId),
    );
    return {
      ...style,
      label: this.getLabel(variantId),
      color: this.getColor(variantId),
      "palette-index": this.#colorIndices.get_trace_index(
        variantIds.getKey(variantId)!,
      ),
    };
  }

  withResolvedColors() {
    return new StatsTable({
      ...this.#p,
      precomputedColorIndices: this.#colorIndices,
    });
  }

  static mergeByVariant<StatsTables extends StatsTable<any>[]>(
    ...l: StatsTables
  ): Merge<StatsTables> {
    const tables = l.filter((t) => t.variantCount > 0 && t.statCount > 0);
    const handles = pipe(
      concat(...tables.map((t) => t.#p.handles)),
      unique,
      (hs) => Uint32Array.from(hs),
    );

    const stats = tables.flatMap((t) => t.#p.stats);
    const labels = new Map(flatMap(tables, (t) => t.#p.labels.entries()));

    // Compute Styles
    // beware: mutating `tables`!
    const first = tables.pop()!;
    const styleBuilder = new lib.TraceStyleSheetUnionBuilder(
      first.#p.variantStyles,
    );
    for (const next of tables) {
      styleBuilder.add(next.#p.handles, next.#p.variantStyles);
    }
    const styles = styleBuilder.collect();

    return new StatsTable<any>({
      handles,
      labels,
      stats,
      variantStyles: styles,
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  withSortedStats(strategy: StatSortingStrategy): StatsTable<CustomData> {
    const direction = strategy.direction === "asc" ? 1 : -1;
    const by = strategy.by;

    if (by === "lexicallyByTitle") {
      return new StatsTable({
        ...this.#p,
        stats: this.#p.stats.toSorted((a, b) => {
          const aTitle = a.title;
          const bTitle = b.title;
          return aTitle.localeCompare(bTitle) * direction;
        }),
      });
    }

    assertNever(by);
  }

  withSortedVariants(strategy: VariantSortingStrategy): StatsTable<CustomData> {
    const direction = strategy.direction === "asc" ? 1 : -1;
    const by = strategy.by;

    if (by === "lexicallyById") {
      return new StatsTable({
        ...this.#p,
        handles: this.#p.handles.toSorted((a, b) => {
          const aId = variantIds.get(a)!;
          const bId = variantIds.get(b)!;
          return aId.localeCompare(bId) * direction;
        }),
      });
    }

    if ("valueOfStat" in by) {
      const stat = this.#p.stats.find((stat) => stat.title === by.valueOfStat);
      if (stat === undefined) return new StatsTable({ ...this.#p });
      return new StatsTable({
        ...this.#p,
        handles: this.#p.handles.toSorted((a, b) => {
          const aValue = stat.data.get(a);
          const bValue = stat.data.get(b);

          if (aValue === undefined) return -1;
          if (bValue === undefined) return 1;
          if (stat.type === "value") {
            return (+aValue! - +bValue!) * direction;
          } else {
            return String(aValue).localeCompare(String(bValue)) * direction;
          }
        }),
      });
    }

    assertNever(by);
  }

  /**
   * Creates an iterator that goes over all the available stat data.
   */
  exportData(): StatsTableExport {
    return new StatsTableExport(this);
  }
}
