import type { InjectionKey } from "svelte-typed-context";
import type { TraceList } from "../../index.js";
import type { Signal, WritableSignal } from "@mod.js/signals";
export type ToolContext = {
  /** Div that wraps the entire chart component */
  notifyOfAutozoom$: Signal<boolean>;
  autoscaleY$: WritableSignal<boolean>;
  getWrapDiv: () => HTMLDivElement;
  toggleLegend: () => void;
  getTracelist: () => TraceList;
  getTitle: () => string;
  toggleFullscreen: () => void;
};

export const toolKey: InjectionKey<ToolContext> = Symbol("toolKey");
