import type { InjectionKey } from "svelte-typed-context";
import type { TraceList } from "../../mod.js";
import type { Signal, WritableSignal } from "@mod.js/signals";
export type ToolContext = {
  /** Div that wraps the entire chart component */
  notifyOfAutozoom$: Signal<boolean>;
  autoscaleY$: WritableSignal<boolean>;
  doUseCommonXRange$: WritableSignal<boolean>;
  fullscreen$: WritableSignal<boolean>;
  getWrapDiv: () => HTMLDivElement;
  toggleLegend: () => void;
  getTracelist: () => TraceList;
  getTitle: () => string;
};

export const toolKey: InjectionKey<ToolContext> = Symbol("toolKey");
