import type { InjectionKey } from "svelte-typed-context";
export type ToolContext = {
  /** Div that wraps the entire chart component */
  getWrapDiv: () => HTMLDivElement;
  toggleLegend: () => void;
};

export const toolKey: InjectionKey<ToolContext> = Symbol("toolKey");
