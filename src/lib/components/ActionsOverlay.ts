import type { HighlightPoint, Shift, Zoom } from "../types.js";

export type VisibleAction = {
  zoom?: Zoom;
  shift?: Shift;
  highlightedPoints?: HighlightPoint[];
};

/** If the zoom rectangle has one side this big or smaller the zoom will be just 1D */
export const oneDZoomWindow = 20;
