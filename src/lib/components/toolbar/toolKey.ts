import type { InjectionKey } from "svelte-typed-context";
import type { TraceList } from "../../index.js";
import type { Signal } from "@mod.js/signals";
export type ToolContext = {
  /** Div that wraps the entire chart component */
  notifyOfAutozoom$: Signal<boolean>;
  getWrapDiv: () => HTMLDivElement;
  toggleLegend: () => void;
  getTracelist: () => TraceList;
  getTitle: () => string;
  toggleFullscreen: () => void;
  toggleAutoscaleY: () => void;
};

export const toolKey: InjectionKey<ToolContext> = Symbol("toolKey");
