import type { InjectionKey } from "svelte-typed-context";
import type { TraceList } from "../../index.js";
export type ToolContext = {
  /** Div that wraps the entire chart component */
  getWrapDiv: () => HTMLDivElement;
  toggleLegend: () => void;
  getTracelist: () => TraceList;
};

export const toolKey: InjectionKey<ToolContext> = Symbol("toolKey");
