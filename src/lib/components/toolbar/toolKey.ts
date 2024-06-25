import type { TraceList } from "../../mod.js";
import type { Signal, WritableSignal } from "@mod.js/signals";
import type { ContextKey } from "svelte";
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

export const toolKey: ContextKey<ToolContext> = Symbol("toolKey");
