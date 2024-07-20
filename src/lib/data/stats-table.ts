import { pipe } from "@mod.js/signals";
import type {
  ChartRange,
  ChartValue,
  DataUnit,
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
} from "@typek/typek";

export interface Stat {
  title: string;
  dataUnit: DataUnit;
  displayUnit: DisplayUnitPreference;
  data: Map<VariantHandle, number>;
}

export interface VariantRow {
  variantId: string;
  style: ComputedTraceStyle;
  stats: VariantCell[];
}
export interface VariantCell {
  statTitle: string;
  value: ChartValue | undefined;
  formattedValue: string | undefined;
}
export interface StatRow {
  statTitle: string;
  variants: StatCell[];
}
export interface StatCell {
  variantId: string;
  value: ChartValue | undefined;
  formattedValue: string | undefined;
  style: ComputedTraceStyle; // FIXME This should prolly be in StatRow, but we have styles for variants, but not for stats :C
}

export interface StatsTableParams {
  handles: VariantHandleArray;
  stats: Stat[];

  labels: ReadonlyMap<string, string>;
  styles: lib.TraceStyleSheet;
  precomputedColorIndices: lib.ResolvedColorIndices | undefined;

  randomSeed: number;
}

export class StatsTable {
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

  static empty() {
    return new StatsTable({
      handles: new Uint32Array([]),
      stats: [],
      labels: new Map(),
      styles: lib.TraceStyleSheet.unset(),
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }

  static fromSingleStat({
    statTitle,
    dataUnit,
    displayUnit,
    ids,
    data,
    style,
    labels,
  }: {
    statTitle: string;
    dataUnit?: DataUnit;
    displayUnit?: DisplayUnitPreference;
    ids: string[];
    data: number[];
    style?: TraceStyleSheet;
    labels?: Iterable<[string, string | undefined]>;
  }) {
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
        {
          title: statTitle,
          dataUnit,
          displayUnit: displayUnit ?? "auto",
          data: new Map(zip(handles, data)),
        },
      ],
    });
  }

  *variantEntries(): Iterable<VariantRow> {
    const ranges = this.#p.stats.map(({ data, dataUnit }) =>
      pipe(
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
      ),
    );

    for (const handle of this.#p.handles) {
      const variantId =
        variantIds.get(handle) ?? yeet(UnknownVariantHandleError, handle);
      const style = this.getStyle(variantId);

      const stats: VariantCell[] = pipe(
        zip(this.#p.stats, ranges),
        (it) =>
          map(it, ([{ title, data, dataUnit, displayUnit }, range]) => {
            const unit = computeDefaultUnit(dataUnit, displayUnit, range);
            const value = data.has(handle)
              ? toChartValue(data.get(handle)!, dataUnit)
              : undefined;

            const formattedValue = value
              ? formatChartValue(value, { unit })
              : undefined;

            return { statTitle: title, value, formattedValue };
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

  *statEntries(): Iterable<StatRow> {
    const ranges = new Map(
      this.#p.stats.map((stat) =>
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
      const range = ranges.get(stat)!;
      const { displayUnit, dataUnit, data, title } = stat;
      const statTitle = title;

      const variants: StatCell[] = pipe(
        map(this.#p.handles, (h) => {
          const variantId =
            variantIds.get(h) ?? yeet(UnknownVariantHandleError, h);
          const style = this.getStyle(variantId);
          const unit = computeDefaultUnit(dataUnit, displayUnit, range);
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
        variants,
      };
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

  static mergeByVariant(...l: StatsTable[]): StatsTable {
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

    return new StatsTable({
      handles,
      labels,
      stats,
      styles,
      precomputedColorIndices: undefined,
      randomSeed: randomUint(),
    });
  }
}
