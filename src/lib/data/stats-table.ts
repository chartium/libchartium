import { pipe } from "@mod.js/signals";
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
  concat,
  enumerate,
  filter,
  flatMap,
  fold,
  map,
  unique,
  yeet,
  zip,
  type ValuesUnion,
} from "@typek/typek";
import { StatsTableExport } from "./data-export.js";

export interface ValueStat {
  title: string;
  dataUnit: DataUnit;
  displayUnit: DisplayUnitPreference;
  data: Map<VariantHandle, number>;
}

export interface CustomStat<T> {
  title: string;
  data: Map<VariantHandle, T>;
}

export type Stat = ValueStat | CustomStat<any>;

export type StatSortingStrategy = {
  direction: "asc" | "desc";
  by: "lexicallyByTitle";
};

export type VariantSortingStrategy = {
  direction: "asc" | "desc";
  by: { valueOfStat: string } | "lexicallyById";
};

export interface VariantRow<Cells extends VariantCell[]> {
  variantId: string;
  style: ComputedTraceStyle;
  stats: Cells;
}
export interface VariantValueCell {
  statTitle: string;
  value: ChartValue | undefined;
  formattedValue: string | undefined;
}
export interface VariantCustomCell<T> {
  statTitle: string;
  value: T | undefined;
}
export type VariantCell = VariantValueCell | VariantCustomCell<any>;

type VariantRowFromStatsMap<StatsMap extends Record<string, Stat>> = VariantRow<
  (ValuesUnion<StatsMap> extends infer Stat
    ? Stat extends ValueStat
      ? VariantValueCell
      : Stat extends CustomStat<infer T>
        ? VariantCustomCell<T>
        : never
    : never)[]
>;

export interface StatValueRow {
  statTitle: string;
  variants: StatValueCell[];
  dataUnit: DataUnit;
  unit: DisplayUnit;
}
export interface StatCustomRow<T> {
  statTitle: string;
  variants: StatCustomCell<T>[];
}
export type StatRow = StatValueRow | StatCustomRow<any>;
export interface StatValueCell {
  variantId: string;
  value: ChartValue | undefined;
  formattedValue: string | undefined;
  style: ComputedTraceStyle;
}
export interface StatCustomCell<T> {
  variantId: string;
  value: T | undefined;
  style: ComputedTraceStyle;
}
export type StatCell = StatValueCell | StatCustomCell<any>;

type StatRowFromStatsMap<StatsMap extends Record<string, Stat>> =
  ValuesUnion<StatsMap> extends infer Stat
    ? Stat extends ValueStat
      ? StatValueRow
      : Stat extends CustomStat<infer T>
        ? StatCustomRow<T>
        : never
    : never;

type MergeStatsTables<StatsTables extends StatsTable<any>[]> = StatsTable<
  StatsTables extends []
    ? Record<string, never>
    : StatsTables extends [
          StatsTable<infer Head>,
          ...infer Tail extends StatsTable<any>[],
        ]
      ? Head & MergeStatsTables<Tail>
      : StatsTables extends StatsTable<infer T>[]
        ? T
        : never
>;

export interface StatsTableParams {
  handles: VariantHandleArray;
  stats: Stat[];

  labels: ReadonlyMap<string, string>;
  styles: lib.TraceStyleSheet;
  precomputedColorIndices: lib.ResolvedColorIndices | undefined;

  randomSeed: number;
}

export class StatsTable<StatsMap extends Record<string, Stat>> {
  #p: Readonly<StatsTableParams>;
  private constructor(params: StatsTableParams) {
    this.#p = params;
  }
  get [PARAMS]() {
    return this.#p;
  }
  static [CONSTRUCTOR](params: StatsTableParams) {
    return new StatsTable(params);
  }

  static empty(): StatsTable<Record<string, never>> {
    return new StatsTable({
      handles: new Uint32Array([]),
      stats: [],
      labels: new Map(),
      styles: lib.TraceStyleSheet.unset(),
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  static fromSingleStat<Title extends string>(opts: {
    statTitle: Title;
    dataUnit?: DataUnit;
    displayUnit?: DisplayUnitPreference;
    ids: string[];
    values: number[];
    style?: TraceStyleSheet;
    labels?: Iterable<[string, string | undefined]>;
  }): StatsTable<{ [t in Title]: ValueStat }>;

  static fromSingleStat<Title extends string, DataType>(opts: {
    statTitle: Title;
    ids: string[];
    customData: DataType[];
    style?: TraceStyleSheet;
    labels?: Iterable<[string, string | undefined]>;
  }): StatsTable<{ [t in Title]: CustomStat<DataType> }>;

  static fromSingleStat<Title extends string>({
    statTitle,
    dataUnit,
    displayUnit,
    ids,
    values,
    customData,
    style,
    labels,
  }: {
    statTitle: Title;
    dataUnit?: DataUnit;
    displayUnit?: DisplayUnitPreference;
    ids: string[];
    values?: number[];
    customData?: any[];
    style?: TraceStyleSheet;
    labels?: Iterable<[string, string | undefined]>;
  }):
    | StatsTable<{ [t in Title]: ValueStat }>
    | StatsTable<{ [t in Title]: CustomStat<any> }> {
    const handles: VariantHandleArray = new Uint32Array(ids.length);

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
      styles: oxidizeStyleSheet(style),
      stats: [
        values
          ? {
              title: statTitle,
              dataUnit,
              displayUnit: displayUnit ?? "auto",
              data: new Map(zip(handles, values)),
            }
          : {
              title: statTitle,
              data: new Map(zip(handles, customData!)),
            },
      ],
    });
  }

  *variantEntries(): Iterable<VariantRowFromStatsMap<StatsMap>> {
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

      const stats: VariantCell[] = pipe(
        zip(this.#p.stats, ranges),
        (it) =>
          map(it, ([stat, range]) => {
            if ("dataUnit" in stat) {
              const { title, data, dataUnit, displayUnit } = stat;
              const unit = computeDefaultUnit(dataUnit, displayUnit, range!);
              const value = data.has(handle)
                ? toChartValue(data.get(handle)!, dataUnit)
                : undefined;

              const formattedValue = value
                ? formatChartValue(value, { unit })
                : undefined;

              return { statTitle: title, value, formattedValue };
            } else {
              return { statTitle: stat.title, value: stat.data.get(handle) };
            }
          }),
        (it) => [...it],
      );

      yield {
        variantId,
        style,
        stats: stats satisfies VariantCell[] as any,
      };
    }
  }

  *statEntries(): Iterable<StatRowFromStatsMap<StatsMap>> {
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
      if ("dataUnit" in stat) {
        const range = ranges.get(stat)!;
        const { displayUnit, dataUnit, data, title } = stat;
        const unit = computeDefaultUnit(dataUnit, displayUnit, range);
        const statTitle = title;

        const variants: StatCell[] = pipe(
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
          statTitle,
          dataUnit,
          unit,
          variants: variants satisfies StatCell[] as any,
        } satisfies StatValueRow as any;
      } else {
        const { title, data } = stat;
        yield {
          statTitle: title,
          variants: pipe(
            map(this.#p.handles, (h) => data.get(h)),
            Array.from<any>,
          ),
        } satisfies StatCustomRow<any> as any;
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
        lib.ResolvedColorIndices.compute(this.#p.styles, this.#p.handles))
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
      this.#p.styles.get_color(
        variantIds.getKey(variantId) ?? yeet(UnknownVariantIdError, variantId),
        this.#colorIndices,
        this.#p.randomSeed,
      ),
    );
  }

  getStyle(variantId: string): ComputedTraceStyle {
    const style = this.#p.styles.get_computed(
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
  ): MergeStatsTables<StatsTables> {
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
    const styleBuilder = new lib.TraceStyleSheetUnionBuilder(first.#p.styles);
    for (const next of tables) {
      styleBuilder.add(next.#p.handles, next.#p.styles);
    }
    const styles = styleBuilder.collect();

    return new StatsTable<any>({
      handles,
      labels,
      stats,
      styles,
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  toSorted(
    strategy: StatSortingStrategy | VariantSortingStrategy,
  ): StatsTable<StatsMap> {
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

    const relevantStat = this.#p.stats.find(
      (stat) => stat.title === by.valueOfStat,
    );
    if (relevantStat === undefined) return new StatsTable({ ...this.#p });
    return new StatsTable({
      ...this.#p,
      handles: this.#p.handles.toSorted((a, b) => {
        const aValue = relevantStat.data.get(a);
        const bValue = relevantStat.data.get(b);

        if (aValue === undefined) return -1;
        if (bValue === undefined) return 1;
        return (aValue - bValue) * direction;
      }),
    });
  }

  /**
   * Creates an iterator that goes over all the available stat data.
   */
  exportData(): StatsTableExport {
    return new StatsTableExport(this);
  }
}
